"""TEST-ONLY stand-in for the parts of FastAPI that app/main.py uses (FastAPI, Depends, Header, Query, Request),
built on Starlette + pydantic, which are installed in the offline sandbox where `pip install fastapi` is blocked.
It exists only so the real app/main.py can be exercised here. On a normal machine install the real FastAPI
(`pip install -r requirements.txt`) and this folder is never used (see tests/_fastapi.py)."""
import inspect, json, typing
from contextlib import asynccontextmanager
from decimal import Decimal
from types import SimpleNamespace

from pydantic import BaseModel, ValidationError
from starlette.applications import Starlette
from starlette.concurrency import run_in_threadpool
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.routing import Mount, Route

__all__ = ["FastAPI", "Depends", "Header", "Query", "Request"]


class _Dep:
    def __init__(self, fn):
        self.fn = fn


class _Param:
    def __init__(self, kind, default=None, le=None):
        self.kind, self.default, self.le = kind, default, le


def Depends(fn):
    return _Dep(fn)


def Header(default=None, **_):
    return _Param("header", default)


def Query(default=None, le=None, **_):
    return _Param("query", default, le)


def encode(o):
    if isinstance(o, BaseModel):
        return encode(o.model_dump())
    if isinstance(o, Decimal):
        return int(o) if o.as_tuple().exponent >= 0 else float(o)
    if isinstance(o, dict):
        return {str(k): encode(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [encode(v) for v in o]
    return o


class _Invalid(Exception):
    def __init__(self, detail):
        self.detail = detail


class FastAPI:
    def __init__(self, title="", version="", lifespan=None):
        self.title, self.lifespan, self.state = title, lifespan, SimpleNamespace()
        self._routes, self._handlers, self._mw, self._mounts, self._app = [], {}, [], [], None

    def add_middleware(self, cls, **kw):
        self._mw.append((cls, kw))

    def mount(self, path, app, name=None):
        self._mounts.append(Mount(path, app=app, name=name))

    def exception_handler(self, exc):
        def deco(fn):
            self._handlers[exc] = fn
            return fn
        return deco

    def _reg(self, method, path):
        def deco(fn):
            self._routes.append((method, path, fn))
            return fn
        return deco

    def get(self, path, **_): return self._reg("GET", path)
    def post(self, path, **_): return self._reg("POST", path)
    def put(self, path, **_): return self._reg("PUT", path)
    def delete(self, path, **_): return self._reg("DELETE", path)

    # --- parameter resolution (header / query / path / body / Depends)
    async def _resolve(self, fn, request, body_cache):
        sig, hints, kw = inspect.signature(fn), typing.get_type_hints(fn), {}
        for name, p in sig.parameters.items():
            d, ann = p.default, hints.get(name)
            if isinstance(d, _Dep):
                kw[name] = await self._call(d.fn, request, body_cache)
            elif isinstance(d, _Param) and d.kind == "header":
                kw[name] = request.headers.get(name.replace("_", "-"), d.default)
            elif isinstance(d, _Param):
                raw = request.query_params.get(name)
                v = d.default if raw is None else (int(raw) if ann is int else raw)
                if d.le is not None and v is not None and v > d.le:
                    raise _Invalid(f"{name} must be <= {d.le}")
                kw[name] = v
            elif name in request.path_params:
                raw = request.path_params[name]
                kw[name] = int(raw) if ann is int else raw
            elif ann is not None and (ann is dict or typing.get_origin(ann) is dict or (inspect.isclass(ann) and issubclass(ann, BaseModel))):
                if "v" not in body_cache:
                    try:
                        body_cache["v"] = await request.json()
                    except Exception:
                        raise _Invalid("invalid JSON body")
                try:
                    kw[name] = ann.model_validate(body_cache["v"]) if inspect.isclass(ann) else body_cache["v"]
                except ValidationError as e:
                    raise _Invalid(str(e))
            elif name in ("request",):
                kw[name] = request
            else:                                   # plain scalar with default = query parameter
                raw = request.query_params.get(name)
                kw[name] = (int(raw) if ann is int else raw) if raw is not None else (None if d is inspect.Parameter.empty else d)
        return kw

    async def _call(self, fn, request, body_cache):
        kw = await self._resolve(fn, request, body_cache)
        if inspect.iscoroutinefunction(fn):
            return await fn(**kw)
        return await run_in_threadpool(lambda: fn(**kw))

    async def _error(self, request, exc):
        for cls in type(exc).__mro__:
            if cls in self._handlers:
                return await self._handlers[cls](request, exc)
        raise exc

    def _endpoint(self, fn):
        async def endpoint(request):
            try:
                out = await self._call(fn, request, {})
                return out if isinstance(out, Response) else JSONResponse(encode(out))
            except _Invalid as e:
                return JSONResponse({"detail": e.detail}, status_code=422)
            except Exception as e:
                return await self._error(request, e)
        return endpoint

    def _build(self):
        routes = [Route(path, self._endpoint(fn), methods=[m]) for m, path, fn in self._routes] + self._mounts

        @asynccontextmanager
        async def lifespan(_):
            if self.lifespan:
                async with self.lifespan(self):
                    yield
            else:
                yield
        from starlette.middleware import Middleware
        return Starlette(routes=routes, lifespan=lifespan, middleware=[Middleware(c, **k) for c, k in self._mw])

    async def __call__(self, scope, receive, send):
        if self._app is None:
            self._app = self._build()
        await self._app(scope, receive, send)

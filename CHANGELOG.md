# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-26

### Added
- `LICENSE` file (MIT)
- `CHANGELOG.md`
- `@Head` and `@Options` HTTP method decorators
- Test coverage for `@Middleware` attribute metadata storage
- Test coverage for `@Decorator` attribute metadata storage and `Finding.getCallStack()` integration
- Test coverage for `@FailRoute` metadata storage, handler registration, and `Group.hasFailRoute()`/`Group.getFailRoute()`
- Test coverage for `@Head` and `@Options` decorator metadata

### Fixed
- Jest worker process teardown warning — all `setTimeout` timers in test helpers are now cleared on success, preventing open handle leaks

### Known Limitations
- `@Middleware` attribute stores middleware class references in metadata but does not execute them at runtime. Use `middleware*` prefix methods for actual middleware execution.
- `@Decorator` attribute stores decorator class references in metadata but does not execute them in the request pipeline. Use `decorate*` prefix methods for response decoration.
- `@FailRoute` stores `asFailRoute: true` in metadata and marks routes as non-requestable, but no catch-all mechanism is implemented in the Express request pipeline. Use `Group.hasFailRoute()` and `Group.getFailRoute()` for manual handling.

## [0.2.0] - 2026-07-20

### Added
- Initial release
- Convention-based routing with method prefixes (`get*`, `post*`, `put*`, `delete*`, `patch*`, `execute*`, `group*`, `sub*`, `route*`, `middleware*`, `decorate*`, `setup*`)
- Decorator-based routing (`@Get`, `@Post`, `@Put`, `@Delete`, `@Patch`)
- Class-level and method-level attribute decorators (`@Path`, `@Name`, `@Method`, `@Middleware`, `@Decorator`, `@Requestable`, `@FailRoute`, `@Tag`, `@State`, `@Series`, `@Flag`, `@Config`, `@Validation`, `@Transformer`, `@Include`)
- Parameter injection decorators (`@Param`, `@Body`, `@Query`, `@Header`, `@Req`, `@Res`, `@Next`, `@Ctx`, `@Inject`)
- Named parameter auto-injection (`namedParamAutoInject`)
- Two routing modes: Express sub-routers (default) and flat routing (`useFlatRouting`)
- IoC container with service, factory, and callable registries
- Per-request Context extending Container
- Transformer pipeline with `@Include` query parameter support
- Express 4 and 5 peer dependency support

import structlog, logging, os

ENV_MODE = os.getenv("ENV_MODE", "LOCAL")

# Set default logging level based on environment
if ENV_MODE.upper() == "PRODUCTION":
    default_level = "DEBUG"
else:
    default_level = "DEBUG" 
    # default_level = "INFO"

LOGGING_LEVEL = logging.getLevelNamesMapping().get(
    os.getenv("LOGGING_LEVEL", default_level).upper(), 
    logging.DEBUG  
)

USE_CONSOLE_RENDERER = ENV_MODE.lower() in ("local", "staging")

renderer = [structlog.processors.JSONRenderer()]
if USE_CONSOLE_RENDERER:
    renderer = [structlog.dev.ConsoleRenderer(colors=True)]

exception_processor = (
    structlog.processors.format_exc_info if USE_CONSOLE_RENDERER else structlog.processors.dict_tracebacks
)

structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        exception_processor,
        structlog.processors.CallsiteParameterAdder(
            {
                structlog.processors.CallsiteParameter.FILENAME,
                structlog.processors.CallsiteParameter.FUNC_NAME,
                structlog.processors.CallsiteParameter.LINENO,
            }
        ),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.contextvars.merge_contextvars,
        *renderer,
    ],
    cache_logger_on_first_use=True,
    wrapper_class=structlog.make_filtering_bound_logger(LOGGING_LEVEL),
)

logger: structlog.stdlib.BoundLogger = structlog.get_logger()

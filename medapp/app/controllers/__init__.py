from .auth import AuthController
from .dashboard import DashboardController
from .doctors import DoctorsController
from .patients import PatientsController
from .agenda import AgendaController
from .reports import ReportsController
from .payments import PaymentsController
from .settings import SettingsController

__all__ = [
    "AuthController",
    "DashboardController",
    "DoctorsController",
    "PatientsController",
    "AgendaController",
    "ReportsController",
    "PaymentsController",
    "SettingsController",
]

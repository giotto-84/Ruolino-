from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.urls import include, path

admin.site.site_header = "Ruolino - Amministrazione"
admin.site.site_title = "Ruolino"

urlpatterns = [
    path("admin/", admin.site.urls),
    path(
        "accesso/",
        auth_views.LoginView.as_view(template_name="personale/login.html"),
        name="login",
    ),
    path("esci/", auth_views.LogoutView.as_view(), name="logout"),
    path(
        "password/",
        auth_views.PasswordChangeView.as_view(
            template_name="personale/form.html",
            success_url="/",
            extra_context={"titolo": "Cambia password"},
        ),
        name="password_change",
    ),
    path("", include("personale.urls")),
]

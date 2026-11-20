from django import template

register = template.Library()


@register.filter
def numero(valore):
    """Mostra 5 invece di 5.00 e 2,5 invece di 2.50."""
    if valore is None or valore == "":
        return ""
    testo = f"{valore:.2f}".rstrip("0").rstrip(".")
    return testo.replace(".", ",")

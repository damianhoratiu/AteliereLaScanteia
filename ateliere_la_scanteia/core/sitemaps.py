from django.conf import settings
from django.contrib.sitemaps import Sitemap

from core.models import JurnalArticlePage, JurnalIndexPage


def get_frontend_base_url():
    return (
        getattr(settings, "PUBLIC_BASE_URL", "").strip().rstrip("/")
        or "https://atelierelascanteia.ro"
    )


class JurnalSitemap(Sitemap):
    changefreq = "weekly"
    priority = 0.7

    def items(self):
        # Only public/live articles should be indexed
        return JurnalArticlePage.objects.live().public().order_by("-first_published_at")

    def location(self, obj):
        frontend_base = get_frontend_base_url()
        return f"{frontend_base}/jurnal/{obj.slug}/"


class JurnalIndexSitemap(Sitemap):
    changefreq = "weekly"
    priority = 0.6

    def items(self):
        # Include the /jurnal/ index page too
        return JurnalIndexPage.objects.live().public()

    def location(self, obj):
        frontend_base = get_frontend_base_url()
        return f"{frontend_base}/jurnal/"
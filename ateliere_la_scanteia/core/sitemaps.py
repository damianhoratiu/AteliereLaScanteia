from django.contrib.sitemaps import Sitemap

from core.models import JurnalArticlePage, JurnalIndexPage


FRONTEND_DOMAIN = "https://atelierelascanteia.ro"


class JurnalSitemap(Sitemap):
    changefreq = "weekly"
    priority = 0.7
    protocol = "https"

    def items(self):
        # Only public/live articles should be indexed
        return JurnalArticlePage.objects.live().public().order_by("-first_published_at")

    def location(self, obj):
        return f"/jurnal/{obj.slug}/"

    def get_urls(self, page=1, site=None, protocol=None):
        urls = super().get_urls(page=page, site=site, protocol=protocol)
        for url in urls:
            path = url["location"]
            if path.startswith("http://") or path.startswith("https://"):
                # just in case
                path = "/" + path.split("/", 3)[-1] if "/" in path[8:] else "/"
            url["location"] = f"{FRONTEND_DOMAIN}{path}"
        return urls


class JurnalIndexSitemap(Sitemap):
    changefreq = "weekly"
    priority = 0.6
    protocol = "https"

    def items(self):
        # Include the /jurnal/ index page too
        return JurnalIndexPage.objects.live().public()

    def location(self, obj):
        return "/jurnal/"

    def get_urls(self, page=1, site=None, protocol=None):
        urls = super().get_urls(page=page, site=site, protocol=protocol)
        for url in urls:
            path = url["location"]
            if path.startswith("http://") or path.startswith("https://"):
                path = "/" + path.split("/", 3)[-1] if "/" in path[8:] else "/"
            url["location"] = f"{FRONTEND_DOMAIN}{path}"
        return urls
from django.contrib.sitemaps import Sitemap

from core.models import JurnalArticlePage, JurnalIndexPage


class JurnalSitemap(Sitemap):
    changefreq = "weekly"
    priority = 0.7

    def items(self):
        # Only public/live articles should be indexed
        return JurnalArticlePage.objects.live().public().order_by("-first_published_at")

    def location(self, obj):
        # Return only the path; Django will prepend the domain automatically
        return f"/jurnal/{obj.slug}/"


class JurnalIndexSitemap(Sitemap):
    changefreq = "weekly"
    priority = 0.6

    def items(self):
        # Include the /jurnal/ index page too
        return JurnalIndexPage.objects.live().public()

    def location(self, obj):
        return "/jurnal/"
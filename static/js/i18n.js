(function () {
    var STORAGE_KEY = "saraiva.lang";
    var translations = window.SITE_TRANSLATIONS || {};

    function lookup(lang, key) {
        var node = translations[lang];
        var parts = key.split(".");
        for (var i = 0; i < parts.length; i++) {
            if (node == null || typeof node !== "object") return undefined;
            node = node[parts[i]];
        }
        return typeof node === "string" ? node : undefined;
    }

    function readInitial() {
        try {
            var params = new URLSearchParams(window.location.search);
            var fromUrl = params.get("lang");
            if (fromUrl === "en" || fromUrl === "pt") return fromUrl;
        } catch (error) { /* keep going */ }
        try {
            var stored = localStorage.getItem(STORAGE_KEY);
            if (stored === "en" || stored === "pt") return stored;
        } catch (error) { /* private mode */ }
        return "en";
    }

    function persist(lang) {
        try {
            localStorage.setItem(STORAGE_KEY, lang);
        } catch (error) { /* private mode */ }
        try {
            var url = new URL(window.location.href);
            if (lang === "pt") url.searchParams.set("lang", "pt");
            else url.searchParams.delete("lang");
            var next = url.pathname + url.search + url.hash;
            var current = window.location.pathname + window.location.search + window.location.hash;
            if (next !== current) history.replaceState(null, "", next);
        } catch (error) { /* file URLs or disabled history */ }
    }

    function setMeta(selector, value) {
        if (!value) return;
        var el = document.querySelector(selector);
        if (el) el.setAttribute("content", value);
    }

    function applyAttributes(el, spec, lang) {
        var pairs = spec.split("|");
        for (var i = 0; i < pairs.length; i++) {
            var pair = pairs[i];
            var splitAt = pair.indexOf(":");
            if (splitAt === -1) continue;
            var attr = pair.slice(0, splitAt);
            var key = pair.slice(splitAt + 1);
            var value = lookup(lang, key);
            if (value == null) {
                console.warn("Missing translation:", lang, key);
                continue;
            }
            el.setAttribute(attr, value);
        }
    }

    function refreshTooltips() {
        var $ = window.jQuery;
        if (!$ || !$.fn || !$.fn.tooltip) return;
        var $live = $(".tooltipped[data-tooltip-id]");
        if (!$live.length) return;
        $live.each(function () {
            var $el = $(this);
            var id = $el.attr("data-tooltip-id");
            if (id) $("#" + id).remove();
            $el.removeAttr("data-tooltip-id");
        });
        $live.tooltip({ delay: 50 });
    }

    function apply(lang) {
        if (!translations[lang]) lang = "en";
        var dict = translations[lang];

        document.documentElement.lang = dict.meta.htmlLang;

        document.querySelectorAll("[data-i18n]").forEach(function (el) {
            var value = lookup(lang, el.getAttribute("data-i18n"));
            if (value == null) {
                console.warn("Missing translation:", lang, el.getAttribute("data-i18n"));
                return;
            }
            el.textContent = value;
        });

        document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
            var value = lookup(lang, el.getAttribute("data-i18n-html"));
            if (value == null) {
                console.warn("Missing translation:", lang, el.getAttribute("data-i18n-html"));
                return;
            }
            el.innerHTML = value;
        });

        document.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
            applyAttributes(el, el.getAttribute("data-i18n-attr"), lang);
        });

        document.title = dict.meta.title;
        setMeta('meta[name="description"]', dict.meta.description);
        setMeta('meta[property="og:title"]', dict.meta.title);
        setMeta('meta[property="og:description"]', dict.meta.description);
        setMeta('meta[property="og:locale"]', dict.meta.locale);
        setMeta('meta[property="og:locale:alternate"]', dict.meta.localeAlternate);
        setMeta('meta[name="keywords"]', dict.meta.keywords);

        var jsonLd = document.getElementById("person-jsonld");
        if (jsonLd) {
            try {
                var data = JSON.parse(jsonLd.textContent);
                data.jobTitle = dict.meta.jobTitle;
                if (data.worksFor) data.worksFor.name = dict.meta.orgName;
                jsonLd.textContent = JSON.stringify(data, null, 2);
            } catch (error) { /* leave the tag as authored */ }
        }

        document.querySelectorAll("[data-set-lang]").forEach(function (button) {
            var active = button.getAttribute("data-set-lang") === lang;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-pressed", active ? "true" : "false");
        });

        persist(lang);
        refreshTooltips();
    }

    document.addEventListener("click", function (event) {
        var button = event.target.closest("[data-set-lang]");
        if (!button) return;
        var lang = button.getAttribute("data-set-lang");
        if (lang !== "en" && lang !== "pt") return;
        apply(lang);
    });

    function start() {
        apply(readInitial());
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
})();

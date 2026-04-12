function YE(i, t) {
  for (var s = 0; s < t.length; s++) {
    const a = t[s];
    if (typeof a != "string" && !Array.isArray(a)) {
      for (const o in a)
        if (o !== "default" && !(o in i)) {
          const h = Object.getOwnPropertyDescriptor(a, o);
          h &&
            Object.defineProperty(
              i,
              o,
              h.get
                ? h
                : {
                    enumerable: !0,
                    get: () => a[o],
                  }
            );
        }
    }
  }
  return Object.freeze(
    Object.defineProperty(i, Symbol.toStringTag, { value: "Module" })
  );
}

(function () {
  const t = document.createElement("link").relList;
  if (t && t.supports && t.supports("modulepreload")) return;

  for (const o of document.querySelectorAll('link[rel="modulepreload"]')) a(o);

  new MutationObserver((o) => {
    for (const h of o)
      if (h.type === "childList")
        for (const f of h.addedNodes)
          f.tagName === "LINK" &&
            f.rel === "modulepreload" &&
            a(f);
  }).observe(document, { childList: !0, subtree: !0 });

  function s(o) {
    const h = {};
    return (
      o.integrity && (h.integrity = o.integrity),
      o.referrerPolicy && (h.referrerPolicy = o.referrerPolicy),
      o.crossOrigin === "use-credentials"
        ? (h.credentials = "include")
        : o.crossOrigin === "anonymous"
        ? (h.credentials = "omit")
        : (h.credentials = "same-origin"),
      h
    );
  }

  function a(o) {
    if (o.ep) return;
    o.ep = !0;
    const h = s(o);
    fetch(o.href, h);
  }
})();

function KE(i) {
  return i &&
    i.__esModule &&
    Object.prototype.hasOwnProperty.call(i, "default")
    ? i.default
    : i;
}

var pd = { exports: {} },
  oo = {};

var h0;

function XE() {
  if (h0) return oo;
  h0 = 1;

  var i = Symbol.for("react.transitional.element"),
    t = Symbol.for("react.fragment");

  function s(a, o, h) {
    var f = null;
    if (h !== void 0 && (f = "" + h), o.key !== void 0 && (f = "" + o.key), "key" in o) {
      h = {};
      for (var g in o) g !== "key" && (h[g] = o[g]);
    } else h = o;

    return (
      (o = h.ref),
      {
        $$typeof: i,
        type: a,
        key: f,
        ref: o !== void 0 ? o : null,
        props: h,
      }
    );
  }

  return (oo.Fragment = t), (oo.jsx = s), (oo.jsxs = s), oo;
}

var f0;

function $E() {
  return f0 || ((f0 = 1), (pd.exports = XE())), pd.exports;
}

var v = $E();
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const ch = url.searchParams.get("ch");
    const sub = url.searchParams.get("sub");
    const ref = url.searchParams.get("ref") || "";
    const clientIp = request.headers.get("CF-Connecting-IP") || "";
    const ua = request.headers.get("User-Agent") || "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

    // Alt akis (Media Playlist) Proxy'si (Kanal D, Show TV, Star, NTV, TRT1 vb. icin)
    if (sub) {
      const subRes = await fetch(sub, {
        headers: {
          "User-Agent": ua,
          ...(ref ? { "Referer": ref, "Origin": new URL(ref).origin } : {})
        }
      });

      const effUrl = subRes.url;
      const cleanUrl = effUrl.split("?")[0];
      const queryPart = effUrl.includes("?") ? "?" + effUrl.split("?") : "";
      const baseDir = cleanUrl.substring(0, cleanUrl.lastIndexOf("/") + 1);
      const hostRoot = new URL(effUrl).origin;
      let text = await subRes.text();

      text = text.split("\n").map(line => {
        const l = line.trim();
        if (!l || l.startsWith("#")) return line;
        let fullTsUrl = l;
        if (!l.startsWith("http")) {
          fullTsUrl = l.startsWith("/") ? (hostRoot + l) : (baseDir + l);
        }
        if (!fullTsUrl.includes("?") && queryPart) {
          fullTsUrl += queryPart;
        }
        return fullTsUrl;
      }).join("\n");

      return new Response(text, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store"
        }
      });
    }

    if (!ch) return new Response("Worker Hazir! Ornek: ?ch=kanald", { status: 200 });

    try {
      // 1. ATV, A SPOR, A2: Taze token al ve Worker icinde fetch yapmadan DOGRUDAN oynaticiya yonlendir (302 Redirect)
      if (ch === "atv" || ch === "aspor" || ch === "a2") {
        const map = {
          atv:   { slug: "atv",   app: "d1ce2d40-5256-4550-b02e-e73c185a314e", ref: "https://www.atv.com.tr/" },
          aspor: { slug: "aspor", app: "b6bf3b55-0120-4e0f-983b-a6c7969f9ec6", ref: "https://www.aspor.com.tr/" },
          a2:    { slug: "a2tv",  app: "59363a60-be96-4f73-9eff-355d0ff2c758", ref: "https://www.atv.com.tr/" }
        };
        const c = map[ch];
        const tokenApi = `https://securevideotoken.tmgrup.com.tr/webtv/secure?${Date.now()}&url=https%3A%2F%2Ftrkvz.daioncdn.net%2F${c.slug}%2F${c.slug}.m3u8%3Fce%3D3%26app%3D${c.app}`;
        const r = await fetch(tokenApi, {
          headers: {
            "User-Agent": ua,
            "Referer": c.ref,
            "Origin": new URL(c.ref).origin,
            "X-Forwarded-For": clientIp
          }
        });
        const j = await r.json();
        if (j && j.Url) {
          // Worker fetch yapmaz (403 yemez!), dogrudan senin telefonunu taze linke 302 ile yonlendirir!
          return Response.redirect(j.Url, 302);
        }
      }

      // 2. NOW TV: Dogrudan BluTV/ERCdn uzerindeki IP kilitsiz canli yayin akisi
      if (ch === "nowtv") {
        const nowRes = await fetch("https://www.nowtv.com.tr/canli-yayin", {
          headers: { "User-Agent": ua, "X-Forwarded-For": clientIp }
        });
        const html = await nowRes.text();
        const m = html.replace(/\\\//g, "/").match(/https:\/\/[^"'<> ]*(?:ercdn|daioncdn|nowtv)[^"'<> ]*\.m3u8[^"'<> ]*/);
        if (m) {
          return Response.redirect(m[0].replace(/&amp;/g, "&"), 302);
        }
      }

      // 3. Diger tum kanallar (Kanal D, Show TV, Star TV, NTV, TRT1, TV8 vb.)
      let masterUrl = "";
      let referer = "";

      if (ch === "kanald") {
        referer = "https://www.kanald.com.tr/";
        masterUrl = "https://demiroren.daioncdn.net/kanald/kanald.m3u8?app=kanald_web&ce=3";
      } else if (ch === "teve2") {
        referer = "https://www.teve2.com.tr/";
        masterUrl = "https://demiroren.daioncdn.net/teve2/teve2.m3u8?ce=3&app=6aab838a-437e-4a1b-bbd0-e30f79cdbbbd";
      } else if (ch === "startv") {
        referer = "https://puhutv.com/";
        masterUrl = "https://dogus.daioncdn.net/startv/startv.m3u8?ce=3&app=7a318fc3-c9cf-4587-b62e-900166ef7190";
      } else if (ch === "ntv") {
        referer = "https://puhutv.com/";
        masterUrl = "https://dogus.daioncdn.net/ntv/ntv.m3u8?ce=3&app=4f0228e3-6605-42f4-9507-d9fe2d9789bd";
      } else if (ch === "showtv") {
        referer = "https://www.showtv.com.tr/";
        masterUrl = "https://ciner.daioncdn.net/showtv/showtv.m3u8?ce=3&app=showtv_web";
      } else if (ch === "tv8") {
        referer = "https://www.tv8.com.tr/";
        masterUrl = "https://tv8.daioncdn.net/tv8/tv8.m3u8?app=7ddc255a-ef47-4e81-ab14-c0e5f2949788&ce=3";
      } else if (ch === "tv85") {
        referer = "https://www.tv8.com.tr/";
        masterUrl = "https://tv8.daioncdn.net/tv8bucuk/tv8bucuk.m3u8?app=tv8bucuk_web&ce=3";
      } else {
        const ghRawUrl = `https://raw.githubusercontent.com/fuatcelep/itpv/main/streams/${ch}.m3u8?t=${Date.now()}`;
        const ghRes = await fetch(ghRawUrl, { headers: { "Cache-Control": "no-cache" } });
        if (ghRes.ok) {
          const ghText = await ghRes.text();
          masterUrl = ghText.replace(/\r/g, "").split("\n").find(l => l.trim().startsWith("http"))?.trim() || "";
        }
      }

      if (!masterUrl) return new Response("Yayin linki bulunamadi", { status: 404 });

      let subUrl = masterUrl;
      if (!masterUrl.includes("_1080") && !masterUrl.includes("_720") && !masterUrl.includes("track_")) {
        const mRes = await fetch(masterUrl, {
          headers: { "User-Agent": ua, ...(referer ? { "Referer": referer, "Origin": new URL(referer).origin } : {}) },
          redirect: "follow"
        });
        const effUrl = mRes.url;
        const cleanUrl = effUrl.split("?")[0];
        const queryPart = effUrl.includes("?") ? "?" + effUrl.split("?") : "";
        const baseDir = cleanUrl.substring(0, cleanUrl.lastIndexOf("/") + 1);
        const hostRoot = new URL(effUrl).origin;
        const mText = await mRes.text();

        if (mText.includes("#EXT-X-STREAM-INF")) {
          const lines = mText.replace(/\r/g, "").split("\n").filter(l => l && !l.startsWith("#"));
          let picked = lines.find(l => /1080|720/i.test(l)) || lines[lines.length - 1];
          if (picked) {
            if (picked.startsWith("http")) subUrl = picked;
            else if (picked.startsWith("/")) subUrl = hostRoot + picked;
            else subUrl = baseDir + picked;
            if (!subUrl.includes("?") && queryPart) subUrl += queryPart;
          }
        } else {
          subUrl = effUrl;
        }
      }

      const proxySubUrl = `${url.origin}/?sub=${encodeURIComponent(subUrl)}&ref=${encodeURIComponent(referer)}`;
      const outM3u8 = `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1920x1080\n${proxySubUrl}\n`;

      return new Response(outM3u8, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store"
        }
      });

    } catch (e) {
      return new Response("Hata: " + e.message, { status: 500 });
    }
  }
};

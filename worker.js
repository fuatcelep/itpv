export default {
  async fetch(request) {
    const url = new URL(request.url);
    const ch = url.searchParams.get("ch");
    const sub = url.searchParams.get("sub");
    const seg = url.searchParams.get("seg");
    const debug = url.searchParams.get("debug");
    const ref = url.searchParams.get("ref") || "";
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

    // 3. ASAMA: .ts Video Segment Proxy
    if (seg) {
      const segRes = await fetch(seg, {
        headers: {
          "User-Agent": ua,
          ...(ref ? { "Referer": ref, "Origin": new URL(ref).origin } : {})
        }
      });
      return new Response(segRes.body, {
        status: segRes.status,
        headers: {
          "Content-Type": segRes.headers.get("Content-Type") || "video/MP2T",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=10"
        }
      });
    }

    // 2. ASAMA: Alt akis (Media Playlist) Proxy'si
    if (sub) {
      const useSegProxy = url.searchParams.get("proxy") === "1";
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
        if (useSegProxy) {
          return `${url.origin}/?seg=${encodeURIComponent(fullTsUrl)}&ref=${encodeURIComponent(ref)}`;
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

    if (!ch) return new Response("Worker Hazir! Ornek: ?ch=atv", { status: 200 });

    let masterUrl = "";
    let referer = "";
    let needSegProxy = false;

    try {
      // 1. Cloudflare'in anlik token alabildigi kanallar
      if (ch === "atv" || ch === "aspor" || ch === "a2") {
        needSegProxy = true;
        const map = {
          atv:   { slug: "atv",   app: "d1ce2d40-5256-4550-b02e-e73c185a314e", ref: "https://www.atv.com.tr/" },
          aspor: { slug: "aspor", app: "b6bf3b55-0120-4e0f-983b-a6c7969f9ec6", ref: "https://www.aspor.com.tr/" },
          a2:    { slug: "a2tv",  app: "59363a60-be96-4f73-9eff-355d0ff2c758", ref: "https://www.atv.com.tr/" }
        };
        const c = map[ch];
        referer = c.ref;
        const tokenApi = `https://securevideotoken.tmgrup.com.tr/webtv/secure?000000&url=https%3A%2F%2Ftrkvz.daioncdn.net%2F${c.slug}%2F${c.slug}.m3u8%3Fce%3D3%26app%3D${c.app}`;
        const r = await fetch(tokenApi, {
          headers: { "User-Agent": ua, "Referer": referer, "Origin": new URL(referer).origin }
        });
        if (r.ok) {
          const j = await r.json();
          masterUrl = j.Url || "";
        }
      } else if (ch === "nowtv") {
        // NOW TV icin dogrudan canli-yayin sayfasindan tokenli m3u8 cek, cekemezse BluTV/Daion yedegine gec
        referer = "https://www.nowtv.com.tr/";
        const r = await fetch("https://www.nowtv.com.tr/canli-yayin", { headers: { "User-Agent": ua } });
        if (r.ok) {
          const html = await r.text();
          const m = html.replace(/\\\//g, "/").match(/https:\/\/[^"'<> ]*(?:ercdn|daioncdn|nowtv)[^"'<> ]*\.m3u8[^"'<> ]*/);
          if (m) masterUrl = m[0].replace(/&amp;/g, "&");
        }
        if (!masterUrl) {
          masterUrl = "https://foxtvdvr.blutv.com/blutv_foxtv_dvr2/live.m3u8";
        }
      } else if (ch === "kanald") {
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
      }

      // Eger yukaridan alinmadiysa Vu+'in GitHub'a attigi streams/<ch>.m3u8 dosyasindan oku
      if (!masterUrl) {
        const ghRawUrl = `https://raw.githubusercontent.com/fuatcelep/itpv/main/streams/${ch}.m3u8?t=${Date.now()}`;
        const ghRes = await fetch(ghRawUrl, { headers: { "Cache-Control": "no-cache" } });
        if (ghRes.ok) {
          const ghText = await ghRes.text();
          masterUrl = ghText.replace(/\r/g, "").split("\n").find(l => l.trim().startsWith("http"))?.trim() || "";
        }
      }

      if (!masterUrl) return new Response("Yayin linki bulunamadi", { status: 404 });

      // Master M3U8 icinden alt akisi coz
      let subUrl = masterUrl;
      let mStatus = 0;
      let mPreview = "";

      if (!masterUrl.includes("_1080") && !masterUrl.includes("_720") && !masterUrl.includes("track_")) {
        const mRes = await fetch(masterUrl, {
          headers: { "User-Agent": ua, ...(referer ? { "Referer": referer, "Origin": new URL(referer).origin } : {}) },
          redirect: "follow"
        });
        mStatus = mRes.status;
        const effUrl = mRes.url;
        const cleanUrl = effUrl.split("?")[0];
        const queryPart = effUrl.includes("?") ? "?" + effUrl.split("?") : "";
        const baseDir = cleanUrl.substring(0, cleanUrl.lastIndexOf("/") + 1);
        const hostRoot = new URL(effUrl).origin;
        const mText = await mRes.text();
        mPreview = mText.substring(0, 300);

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

      if (debug === "1") {
        return new Response(JSON.stringify({ ch, masterUrl, mStatus, subUrl, mPreview }, null, 2), {
          headers: { "Content-Type": "application/json" }
        });
      }

      const proxySubUrl = `${url.origin}/?sub=${encodeURIComponent(subUrl)}&ref=${encodeURIComponent(referer)}&proxy=${needSegProxy ? "1" : "0"}`;
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

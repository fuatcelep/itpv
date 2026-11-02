export default {
  async fetch(request) {
    const url = new URL(request.url);
    const ch = url.searchParams.get("ch");
    const sub = url.searchParams.get("sub");
    const ref = url.searchParams.get("ref") || "";
    const ts = Math.floor(Date.now() / 1000);
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

    // Alt akis (sub-playlist) proxy yapisi
    if (sub) {
      const subRes = await fetch(sub, {
        headers: { "User-Agent": ua, ...(ref ? { "Referer": ref, "Origin": new URL(ref).origin } : {}) }
      });
      const effUrl = subRes.url;
      const baseDir = effUrl.split("?")[0].substring(0, effUrl.split("?")[0].lastIndexOf("/") + 1);
      const hostRoot = new URL(effUrl).origin;
      let text = await subRes.text();

      text = text.split("\n").map(line => {
        const l = line.trim();
        if (!l || l.startsWith("#")) return line;
        if (l.startsWith("http")) return l;
        if (l.startsWith("/")) return hostRoot + l;
        return baseDir + l;
      }).join("\n");

      return new Response(text, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store"
        }
      });
    }

    if (!ch) return new Response("Worker Hazir! Ornek kullanim: ?ch=kanald", { status: 200 });

    let masterUrl = "";
    let referer = "";

    try {
      switch (ch) {
        // --- 1. TRT GRUBU ---
        case "trt1":
          referer = "https://www.trtizle.com/";
          masterUrl = "https://tv-trt1.medya.trt.com.tr/master.m3u8";
          break;
        case "trtspor":
          referer = "https://www.trtizle.com/";
          masterUrl = "https://tv-trtspor1.medya.trt.com.tr/master.m3u8";
          break;
        case "trtsporyildiz":
          referer = "https://www.trtizle.com/";
          masterUrl = "https://tv-trtspor2.medya.trt.com.tr/master.m3u8";
          break;
        case "trthaber":
          referer = "https://www.trtizle.com/";
          masterUrl = "https://tv-trthaber.medya.trt.com.tr/master.m3u8";
          break;

        // --- 2. TURKUVAZ MEDYA GRUBU (ATV, A SPOR, A2) ---
        case "atv": {
          referer = "https://www.atv.com.tr/";
          const r = await fetch(`https://securevideotoken.tmgrup.com.tr/webtv/secure?${ts}&url=https%3A%2F%2Ftrkvz.daioncdn.net%2Fatv%2Fatv.m3u8%3Fce%3D3%26app%3Dd1ce2d40-5256-4550-b02e-e73c185a314e`, { headers: { "User-Agent": ua, "Referer": referer, "Origin": "https://www.atv.com.tr" } });
          masterUrl = (await r.json()).Url;
          break;
        }
        case "aspor": {
          referer = "https://www.aspor.com.tr/";
          const r = await fetch(`https://securevideotoken.tmgrup.com.tr/webtv/secure?${ts}&url=https%3A%2F%2Ftrkvz.daioncdn.net%2Faspor%2Faspor.m3u8%3Fce%3D3%26app%3Db6bf3b55-0120-4e0f-983b-a6c7969f9ec6`, { headers: { "User-Agent": ua, "Referer": referer, "Origin": "https://www.aspor.com.tr" } });
          masterUrl = (await r.json()).Url;
          break;
        }
        case "a2": {
          referer = "https://www.atv.com.tr/";
          const r = await fetch(`https://securevideotoken.tmgrup.com.tr/webtv/secure?${ts}&url=https%3A%2F%2Ftrkvz.daioncdn.net%2Fa2tv%2Fa2tv.m3u8%3Fce%3D3%26app%3D59363a60-be96-4f73-9eff-355d0ff2c758`, { headers: { "User-Agent": ua, "Referer": referer, "Origin": "https://www.atv.com.tr" } });
          masterUrl = (await r.json()).Url;
          break;
        }

        # --- 3. DEMİRÖREN GRUBU (KANAL D, TEVE2, CNN TÜRK) ---
        case "kanald":
          referer = "https://www.kanald.com.tr/";
          masterUrl = "https://demiroren.daioncdn.net/kanald/kanald.m3u8?app=kanald_web&ce=3";
          break;
        case "teve2":
          referer = "https://www.teve2.com.tr/";
          masterUrl = "https://demiroren.daioncdn.net/teve2/teve2.m3u8?ce=3&app=6aab838a-437e-4a1b-bbd0-e30f79cdbbbd";
          break;
        case "cnnturk": {
          referer = "https://www.cnnturk.com/canli-yayin";
          const j = await (await fetch(`https://www.cnnturk.com/action/media/62d6814670380e2cdc7c124c?_=${ts}`, { headers: { "User-Agent": ua, "Referer": referer } })).json();
          const srv = j?.Media?.Link?.ServiceUrl || "";
          const path = j?.Media?.Link?.SecurePath || "";
          masterUrl = srv + path;
          break;
        }

        # --- 4. DOĞUŞ MEDYA GRUBU (STAR TV, NTV) ---
        case "startv":
          referer = "https://puhutv.com/";
          masterUrl = "https://dogus.daioncdn.net/startv/startv.m3u8?ce=3&app=7a318fc3-c9cf-4587-b62e-900166ef7190";
          break;
        case "ntv":
          referer = "https://puhutv.com/";
          masterUrl = "https://dogus.daioncdn.net/ntv/ntv.m3u8?ce=3&app=4f0228e3-6605-42f4-9507-d9fe2d9789bd";
          break;

        # --- 5. ACUN MEDYA (TV8, TV8.5) ---
        case "tv8":
          referer = "https://www.tv8.com.tr/";
          masterUrl = "https://tv8.daioncdn.net/tv8/tv8.m3u8?app=7ddc255a-ef47-4e81-ab14-c0e5f2949788&ce=3";
          break;
        case "tv85":
          referer = "https://www.tv8.com.tr/";
          masterUrl = "https://tv8.daioncdn.net/tv8bucuk/tv8bucuk.m3u8?app=tv8bucuk_web&ce=3";
          break;

        # --- 6. DİĞER ULUSAL KANALLAR (SHOW TV, NOW TV, 360 TV, HALK TV, SZC) ---
        case "showtv":
          referer = "https://www.showtv.com.tr/";
          masterUrl = "https://ciner.daioncdn.net/showtv/showtv.m3u8?ce=3&app=showtv_web";
          break;
        case "nowtv":
          referer = "https://www.nowtv.com.tr/";
          masterUrl = "https://fox-now-live.daioncdn.net/nowtv/nowtv.m3u8?ce=3&app=nowtv_web";
          break;
        case "360tv":
          referer = "https://www.tv360.com.tr/";
          masterUrl = "https://turkmedya-live.ercdn.net/tv360/tv360.m3u8";
          break;
        case "halktv":
          referer = "https://halktv.com.tr/";
          masterUrl = "https://halktv-live.daioncdn.net/halktv/halktv.m3u8";
          break;
        case "szc":
          referer = "https://www.szctv.com.tr/";
          // Sozcu TV yedekli dinamik stream linki
          masterUrl = "https://cdn.tecostream.xyz/Sozcu_Tv.m3u8";
          break;

        # --- 7. SPOR & YABANCI AKIŞLAR (beIN SPORTS HABER) ---
        case "beinsportshaber":
          referer = "https://beinsports.com.tr/";
          masterUrl = "https://raw.githubusercontent.com/tecotv2025/tecotv/refs/heads/main/playlist/Bein_Spor_Haber.m3u8";
          break;
      }

      if (!masterUrl) return new Response("Master URL alinamadi", { status: 404 });

      const mRes = await fetch(masterUrl, {
        headers: { 
          "User-Agent": ua, 
          ...(referer ? { "Referer": referer, "Origin": new URL(referer).origin } : {}) 
        },
        redirect: "follow"
      });
      
      const effUrl = mRes.url;
      const baseDir = effUrl.split("?")[0].substring(0, effUrl.split("?")[0].lastIndexOf("/") + 1);
      const hostRoot = new URL(effUrl).origin;
      const mText = await mRes.text();

      let subUrl = effUrl;
      if (mText.includes("#EXT-X-STREAM-INF")) {
        const lines = mText.replace(/\r/g, "").split("\n").filter(l => l && !l.startsWith("#"));
        let picked = lines.find(l => /1080|720|track_4_1000/i.test(l)) || lines[lines.length - 1];
        if (picked) {
          if (picked.startsWith("http")) subUrl = picked;
          else if (picked.startsWith("/")) subUrl = hostRoot + picked;
          else subUrl = baseDir + picked;
        }
      }

      const proxySubUrl = `${url.origin}/?sub=${encodeURIComponent(subUrl)}&ref=${encodeURIComponent(referer)}`;
      const wrapperM3u8 = `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1920x1080\n${proxySubUrl}\n`;

      return new Response(wrapperM3u8, {
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

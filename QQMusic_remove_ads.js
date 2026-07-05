const TARGET_METHODS = [
  // “我的”页金币顶棚气泡。
  "music.personal.PersonalCanopyBubbleCgi.GetCanopyBubble",

  // 雷达广告与页签推广气泡。
  "music.recommend.RadarAdInfoReadServer.QueryRadarAdInfo",
  "music.commonService.PopupWindow.QueryTabBubbleV2",

  // 播放页、歌单页及音质相关会员推广。
  "music.vip.VIPSubscriptionPromoCgi.ListSubscriptionNotices",
  "music.vip.ExcSoundBenefitSvr.GetVIPStartButton",
  "music.commonService.CommonBubbleSvr.QueryPlayPageBubble",
  "music.superSound.AudioEffectQualityMinibarSvr.GetSVIPMinibarTips",
  "music.vip.ExcSoundBenefitSvr.GetSoundQualityBanner",
  "music.vip.PlaylistVipRemindSvr.GetPlaylistVipRemind",
];

function toBytes(body) {
  if (body instanceof Uint8Array) {
    return body;
  }

  if (typeof body === "string") {
    const bytes = new Uint8Array(body.length);
    for (let index = 0; index < body.length; index += 1) {
      bytes[index] = body.charCodeAt(index) & 0xff;
    }
    return bytes;
  }

  return null;
}

function containsAscii(bytes, text) {
  if (!bytes || bytes.length < text.length) {
    return false;
  }

  outer:
  for (let start = 0; start <= bytes.length - text.length; start += 1) {
    for (let offset = 0; offset < text.length; offset += 1) {
      if (bytes[start + offset] !== text.charCodeAt(offset)) {
        continue outer;
      }
    }
    return true;
  }

  return false;
}

const requestBytes = toBytes($request.body);
const shouldBlock = TARGET_METHODS.some((method) =>
  containsAscii(requestBytes, method)
);

if (shouldBlock) {
  $done({
    response: {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "no-store",
      },
      body: new Uint8Array(0),
    },
  });
} else {
  $done({});
}

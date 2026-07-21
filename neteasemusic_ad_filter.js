/*!
 * 网易云音乐净化 5.1
 * Loon-only response filter.
 *
 * Based on Yu9191/NeteasemusicAd.
 * Original Copyright (c) 2026 Yu9191. Licensed under the MIT License.
 */

const DEFAULT_SETTINGS = Object.freeze({
  BottomSimple: true,
  TopRcmd: true,
  TopMusic: true,
  TopPodcast: false,
  TopBook: false,
  TopLive: false,
  TopAI: false,
  HomeSimple: true,
  CommentClean: true,
  MineClean: true,
  AdClean: true,
});

function readSettings() {
  const args =
    globalThis.$argument && typeof globalThis.$argument === "object"
      ? globalThis.$argument
      : {};
  return Object.fromEntries(
    Object.entries(DEFAULT_SETTINGS).map(([name, fallback]) => {
      const value = args[name];
      if (value === undefined || value === null || value === `{${name}}`) {
        return [name, fallback];
      }
      return [
        name,
        value === true || value === 1 || value === "true" || value === "1",
      ];
    }),
  );
}

const SETTINGS = readSettings();
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder("utf-8");
const EAPI_KEY = TEXT_ENCODER.encode("e82ckenh8dichen8");

// Minimal AES-128 ECB implementation. NetEase eapi responses use this fixed
// key with PKCS#7 padding; no other CryptoJS functionality is required.
const AES_SBOX = Uint8Array.from([
  0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe,
  0xd7, 0xab, 0x76, 0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4,
  0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0, 0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7,
  0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15, 0x04, 0xc7, 0x23, 0xc3,
  0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75, 0x09,
  0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3,
  0x2f, 0x84, 0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe,
  0x39, 0x4a, 0x4c, 0x58, 0xcf, 0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85,
  0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8, 0x51, 0xa3, 0x40, 0x8f, 0x92,
  0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2, 0xcd, 0x0c,
  0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19,
  0x73, 0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14,
  0xde, 0x5e, 0x0b, 0xdb, 0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2,
  0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79, 0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5,
  0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08, 0xba, 0x78, 0x25,
  0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
  0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86,
  0xc1, 0x1d, 0x9e, 0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e,
  0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf, 0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42,
  0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
]);
const AES_INV_SBOX = new Uint8Array(256);
for (let index = 0; index < AES_SBOX.length; index += 1) {
  AES_INV_SBOX[AES_SBOX[index]] = index;
}
const AES_RCON = Uint8Array.from([
  0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36,
]);

function expandAesKey(key) {
  if (key.length !== 16) throw new Error("AES-128 key must be 16 bytes");
  const expanded = new Uint8Array(176);
  expanded.set(key);
  const word = new Uint8Array(4);
  let generated = 16;
  let round = 1;
  while (generated < expanded.length) {
    word.set(expanded.subarray(generated - 4, generated));
    if (generated % 16 === 0) {
      const first = word[0];
      word[0] = AES_SBOX[word[1]] ^ AES_RCON[round];
      word[1] = AES_SBOX[word[2]];
      word[2] = AES_SBOX[word[3]];
      word[3] = AES_SBOX[first];
      round += 1;
    }
    for (let offset = 0; offset < 4; offset += 1) {
      expanded[generated] = expanded[generated - 16] ^ word[offset];
      generated += 1;
    }
  }
  return expanded;
}

const AES_ROUND_KEYS = expandAesKey(EAPI_KEY);

function addRoundKey(state, round) {
  const offset = round * 16;
  for (let index = 0; index < 16; index += 1)
    state[index] ^= AES_ROUND_KEYS[offset + index];
}

function shiftRows(state) {
  let value = state[1];
  state[1] = state[5];
  state[5] = state[9];
  state[9] = state[13];
  state[13] = value;
  value = state[2];
  const second = state[6];
  state[2] = state[10];
  state[6] = state[14];
  state[10] = value;
  state[14] = second;
  value = state[3];
  state[3] = state[15];
  state[15] = state[11];
  state[11] = state[7];
  state[7] = value;
}

function inverseShiftRows(state) {
  let value = state[13];
  state[13] = state[9];
  state[9] = state[5];
  state[5] = state[1];
  state[1] = value;
  value = state[2];
  const second = state[6];
  state[2] = state[10];
  state[6] = state[14];
  state[10] = value;
  state[14] = second;
  value = state[3];
  state[3] = state[7];
  state[7] = state[11];
  state[11] = state[15];
  state[15] = value;
}

function xtime(value) {
  return ((value << 1) ^ (value & 0x80 ? 0x1b : 0)) & 0xff;
}

function multiply(value, factor) {
  let result = 0;
  let current = value;
  let mask = factor;
  while (mask) {
    if (mask & 1) result ^= current;
    current = xtime(current);
    mask >>>= 1;
  }
  return result;
}

const AES_MUL9 = Uint8Array.from({ length: 256 }, (_, value) =>
  multiply(value, 9),
);
const AES_MUL11 = Uint8Array.from({ length: 256 }, (_, value) =>
  multiply(value, 11),
);
const AES_MUL13 = Uint8Array.from({ length: 256 }, (_, value) =>
  multiply(value, 13),
);
const AES_MUL14 = Uint8Array.from({ length: 256 }, (_, value) =>
  multiply(value, 14),
);

function mixColumns(state) {
  for (let column = 0; column < 4; column += 1) {
    const index = column * 4;
    const a = state[index];
    const b = state[index + 1];
    const c = state[index + 2];
    const d = state[index + 3];
    const all = a ^ b ^ c ^ d;
    state[index] ^= all ^ xtime(a ^ b);
    state[index + 1] ^= all ^ xtime(b ^ c);
    state[index + 2] ^= all ^ xtime(c ^ d);
    state[index + 3] ^= all ^ xtime(d ^ a);
  }
}

function inverseMixColumns(state) {
  for (let column = 0; column < 4; column += 1) {
    const index = column * 4;
    const a = state[index];
    const b = state[index + 1];
    const c = state[index + 2];
    const d = state[index + 3];
    state[index] = AES_MUL14[a] ^ AES_MUL11[b] ^ AES_MUL13[c] ^ AES_MUL9[d];
    state[index + 1] = AES_MUL9[a] ^ AES_MUL14[b] ^ AES_MUL11[c] ^ AES_MUL13[d];
    state[index + 2] = AES_MUL13[a] ^ AES_MUL9[b] ^ AES_MUL14[c] ^ AES_MUL11[d];
    state[index + 3] = AES_MUL11[a] ^ AES_MUL13[b] ^ AES_MUL9[c] ^ AES_MUL14[d];
  }
}

function encryptAesBlock(block) {
  const state = Uint8Array.from(block);
  addRoundKey(state, 0);
  for (let round = 1; round < 10; round += 1) {
    for (let index = 0; index < 16; index += 1)
      state[index] = AES_SBOX[state[index]];
    shiftRows(state);
    mixColumns(state);
    addRoundKey(state, round);
  }
  for (let index = 0; index < 16; index += 1)
    state[index] = AES_SBOX[state[index]];
  shiftRows(state);
  addRoundKey(state, 10);
  return state;
}

function decryptAesBlock(block) {
  const state = Uint8Array.from(block);
  addRoundKey(state, 10);
  for (let round = 9; round > 0; round -= 1) {
    inverseShiftRows(state);
    for (let index = 0; index < 16; index += 1)
      state[index] = AES_INV_SBOX[state[index]];
    addRoundKey(state, round);
    inverseMixColumns(state);
  }
  inverseShiftRows(state);
  for (let index = 0; index < 16; index += 1)
    state[index] = AES_INV_SBOX[state[index]];
  addRoundKey(state, 0);
  return state;
}

function encryptAesEcb(bytes) {
  const padding = 16 - (bytes.length % 16);
  const padded = new Uint8Array(bytes.length + padding);
  padded.set(bytes);
  padded.fill(padding, bytes.length);
  const encrypted = new Uint8Array(padded.length);
  for (let offset = 0; offset < padded.length; offset += 16) {
    encrypted.set(
      encryptAesBlock(padded.subarray(offset, offset + 16)),
      offset,
    );
  }
  return encrypted;
}

function decryptAesEcb(bytes) {
  if (!bytes.length || bytes.length % 16 !== 0)
    throw new Error("invalid AES payload length");
  const decrypted = new Uint8Array(bytes.length);
  for (let offset = 0; offset < bytes.length; offset += 16) {
    decrypted.set(decryptAesBlock(bytes.subarray(offset, offset + 16)), offset);
  }
  const padding = decrypted[decrypted.length - 1];
  if (padding < 1 || padding > 16) throw new Error("invalid PKCS#7 padding");
  for (
    let index = decrypted.length - padding;
    index < decrypted.length;
    index += 1
  ) {
    if (decrypted[index] !== padding) throw new Error("invalid PKCS#7 padding");
  }
  return decrypted.slice(0, decrypted.length - padding);
}

function toBytes(body) {
  if (body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (ArrayBuffer.isView(body))
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  if (typeof body === "string") {
    const bytes = new Uint8Array(body.length);
    for (let index = 0; index < body.length; index += 1)
      bytes[index] = body.charCodeAt(index) & 0xff;
    return bytes;
  }
  throw new TypeError(`unsupported body type: ${typeof body}`);
}

function isGzip(bytes) {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

function ungzip(bytes) {
  if (!isGzip(bytes)) return bytes;
  if (typeof globalThis.$utils?.ungzip !== "function")
    throw new Error("Loon $utils.ungzip is unavailable");
  return toBytes(globalThis.$utils.ungzip(bytes));
}

function decodeResponseBody(body) {
  const received = ungzip(toBytes(body));
  try {
    const decrypted = ungzip(decryptAesEcb(received));
    return JSON.parse(TEXT_DECODER.decode(decrypted));
  } catch (aesError) {
    try {
      return JSON.parse(TEXT_DECODER.decode(received));
    } catch (plainError) {
      throw new Error(
        `cannot decode response (AES: ${aesError.message}; JSON: ${plainError.message})`,
      );
    }
  }
}

function encodeResponseBody(payload) {
  return encryptAesEcb(TEXT_ENCODER.encode(JSON.stringify(payload)));
}

function extractApiPath(url) {
  return (
    url.match(
      /^https?:\/\/[^/]+\/(?:x?e?api)(\/[a-z0-9-/]+)(?:\?.*)?$/i,
    )?.[1] ?? null
  );
}

const COMMENT_DECORATION_FIELDS = [
  "tag",
  "tags",
  "commentTag",
  "commentTags",
  "contentTags",
  "tagDatas",
  "topicList",
  "bottomTags",
];

function cleanCommentTree(value) {
  if (!value || typeof value !== "object") return 0;
  let changes = 0;
  if (Array.isArray(value)) {
    for (const item of value) changes += cleanCommentTree(item);
    return changes;
  }
  if (value.user && typeof value.user === "object") {
    if (value.user.followed === false) {
      value.user.followed = true;
      changes += 1;
    }
    for (const field of [
      "vipRights",
      "avatarDetail",
      "commonIdentity",
      "relationTag",
    ]) {
      if (field in value.user && value.user[field] !== null) {
        value.user[field] = null;
        changes += 1;
      }
    }
    if ("vipType" in value.user && value.user.vipType !== 0) {
      value.user.vipType = 0;
      changes += 1;
    }
  }
  for (const field of [
    "userBizLevels",
    "userNameplates",
    "pendantData",
    "medal",
    "decoration",
  ]) {
    if (field in value && value[field] !== null) {
      value[field] = null;
      changes += 1;
    }
  }
  for (const field of COMMENT_DECORATION_FIELDS) {
    if (field in value) {
      delete value[field];
      changes += 1;
    }
  }
  for (const child of Object.values(value)) changes += cleanCommentTree(child);
  return changes;
}

const HOME_BLOCK_CODES = new Set([
  "PAGE_RECOMMEND_DAILY_RECOMMEND",
  "PAGE_RECOMMEND_SPECIAL_CLOUD_VILLAGE_PLAYLIST",
  "PAGE_RECOMMEND_RADAR",
  "PAGE_RECOMMEND_RANK",
  "PAGE_RECOMMEND_MY_SHEET",
  "PAGE_RECOMMEND_COMBINATION",
  "PAGE_RECOMMEND_PRIVATE_RCMD_SONG",
  "PAGE_RECOMMEND_RED_SIMILAR_SONG",
]);

function filterSerializedCodes(value) {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return value;
    const filtered = parsed.filter((code) => HOME_BLOCK_CODES.has(code));
    return filtered.length === parsed.length ? value : JSON.stringify(filtered);
  } catch {
    return value;
  }
}

function cleanHomeRecommendation(payload) {
  if (!SETTINGS.HomeSimple || !payload.data) return false;
  const data = payload.data;
  let changed = false;
  if (Array.isArray(data.blocks)) {
    const filtered = data.blocks.filter((block) =>
      HOME_BLOCK_CODES.has(block?.bizCode),
    );
    if (filtered.length !== data.blocks.length) {
      data.blocks = filtered;
      changed = true;
    }
  }
  for (const field of ["blockCodeOrderList", "algDemoteBlockCodeOrderList"]) {
    if (typeof data[field] === "string") {
      const filtered = filterSerializedCodes(data[field]);
      if (filtered !== data[field]) {
        data[field] = filtered;
        changed = true;
      }
    }
  }
  if (Array.isArray(data.requestBlockOrder)) {
    const filtered = data.requestBlockOrder.filter((code) =>
      HOME_BLOCK_CODES.has(code),
    );
    if (filtered.length !== data.requestBlockOrder.length) {
      data.requestBlockOrder = filtered;
      changed = true;
    }
  }
  if ("hasMore" in data && data.hasMore !== false) {
    data.hasMore = false;
    changed = true;
  }
  if ("cursor" in data && data.cursor !== -1) {
    data.cursor = -1;
    changed = true;
  }
  return changed;
}

function clearSubtitles(value) {
  if (!value || typeof value !== "object") return 0;
  let changes = 0;
  for (const [key, child] of Object.entries(value)) {
    if ((key === "subTitle" || key === "subtitle") && child !== "") {
      value[key] = "";
      changes += 1;
    } else if (child && typeof child === "object") {
      changes += clearSubtitles(child);
    }
  }
  return changes;
}

const SIDEBAR_ITEM_CODES = new Set([
  "ai_songwriting",
  "mall",
  "concert",
  "cloud_push_song",
]);

function getSidebarItemCode(item) {
  return item?.sideBarItemData3?.code ?? item?.code ?? item?.s_cid;
}

function filterGeneralizedObjects(resource) {
  if (
    !resource ||
    typeof resource !== "object" ||
    !Array.isArray(resource.generalizedObject)
  )
    return 0;
  const filtered = resource.generalizedObject.filter(
    (item) => !SIDEBAR_ITEM_CODES.has(getSidebarItemCode(item)),
  );
  const removed = resource.generalizedObject.length - filtered.length;
  if (removed) resource.generalizedObject = filtered;
  return removed;
}

const PLAYER_VIEW_TYPES = new Set([
  "NMHintMVSwitchView",
  "FastPlayRecReasonBubbleView",
  "musicianTalk",
  "artistFollow",
]);
const PLAYER_PROMO_POSITIONS = new Set([
  "player_vinyl_float_guide",
  "player_bottom_toast",
  "player_bottom_left_entrance",
  "player_bottom_left",
  "player_bottom_left_scene",
  "fast_player_middle_left_toast",
  "player_global_bubble",
  "vinyl_comment_entrance",
]);

function cleanPlayerHints(payload) {
  if (!SETTINGS.AdClean || !Array.isArray(payload.data?.hints)) return false;
  const removedTokens = new Set();
  const filtered = payload.data.hints.filter((hint) => {
    const viewType = hint?.template?.extra?.viewType;
    const position =
      hint?.position?.code ?? hint?.data?.extra?.positionCode ?? "";
    const identifiers = [
      hint?.code,
      hint?.data?.extra?.code,
      hint?.data?.extra?.channelCode,
      hint?.data?.extra?.trp_id,
    ]
      .filter(Boolean)
      .map(String);
    const joined = identifiers.join("|");
    const remove =
      PLAYER_VIEW_TYPES.has(viewType) ||
      PLAYER_PROMO_POSITIONS.has(position) ||
      joined.includes("heijiao_dj_wiki_pop_channel") ||
      /UgcVideoChange/i.test(joined);
    if (!remove) return true;
    if (position) removedTokens.add(String(position));
    for (const identifier of identifiers) {
      removedTokens.add(identifier);
      const suffix = identifier.split("@").pop();
      if (suffix?.length > 8) removedTokens.add(suffix);
    }
    return false;
  });
  if (filtered.length === payload.data.hints.length) return false;
  payload.data.hints = filtered;
  if (Array.isArray(payload.trp?.rules) && removedTokens.size) {
    payload.trp.rules = payload.trp.rules.filter(
      (rule) =>
        ![...removedTokens].some((token) => String(rule).includes(token)),
    );
  }
  return true;
}

const TOP_TAB_SETTING_BY_CODE = Object.freeze({
  rcmd: "TopRcmd",
  music: "TopMusic",
  podcast: "TopPodcast",
  vBook: "TopBook",
  live: "TopLive",
  "ai-generate-song": "TopAI",
});
const TOP_TAB_SETTING_BY_TITLE = Object.freeze({
  推荐: "TopRcmd",
  音乐: "TopMusic",
  播客: "TopPodcast",
  听书: "TopBook",
  午夜飞行: "TopLive",
  AI写歌: "TopAI",
});

function replaceData(payload, path, data) {
  if (payload[path]?.data === undefined) return false;
  payload[path].data = data;
  return true;
}

const HANDLERS = {
  "/batch": (payload) => {
    let changed = false;
    if (SETTINGS.AdClean) {
      changed =
        replaceData(payload, "/api/comment/tips/v2/get", {
          count: 0,
          offset: 0,
          records: [],
        }) || changed;
      changed =
        replaceData(payload, "/api/social/event/bff/ad/resources", {}) ||
        changed;
      changed =
        replaceData(payload, "/api/ad/get", { code: 200, ads: {} }) || changed;
      changed =
        replaceData(
          payload,
          "/api/platform/song/bff/grading/song/order/entrance",
          { songOrderEntrance: {} },
        ) || changed;
    }
    if (SETTINGS.MineClean) {
      changed =
        replaceData(payload, "/api/creator/musician/reminder/message/get", {
          message: "",
        }) || changed;
    }
    if (SETTINGS.CommentClean) {
      changed =
        replaceData(payload, "/api/event/rcmd/topic/list", { topicList: [] }) ||
        changed;
      changed =
        cleanCommentTree(payload["/api/v2/resource/comments"]?.data) > 0 ||
        changed;
      for (const path of [
        "/api/comment/feed/inserted/resources",
        "/api/comment/feed/inserted/resources/combined",
      ]) {
        if (payload[path]?.data !== undefined) {
          payload[path].data = {
            count: 0,
            offset: 0,
            records: [],
            delayRender: false,
          };
          if (Array.isArray(payload[path].trp?.rules))
            payload[path].trp.rules = [];
          changed = true;
        }
      }
    }
    return changed;
  },
  "/v2/resource/comments": (payload) =>
    SETTINGS.CommentClean && cleanCommentTree(payload.data) > 0,
  "/v2/resource/comment/floor/get": (payload) =>
    SETTINGS.CommentClean && cleanCommentTree(payload.data) > 0,
  "/resource/comments/reply/preload": (payload) =>
    SETTINGS.CommentClean &&
    cleanCommentTree(payload.data?.preloadCommentMap ?? payload.data) > 0,
  "/moment/tab/info/get": (payload) => {
    if (!SETTINGS.CommentClean) return false;
    payload.data = { tabStatus: 0, momentNum: 0 };
    return true;
  },
  "/comment/feed/inserted/resources/combined": cleanInsertedResources,
  "/comment/feed/inserted/resources": cleanInsertedResources,
  "/moment/pub/entrance/get": (payload) => {
    if (!SETTINGS.CommentClean) return false;
    payload.data = {
      icon: "",
      targetUrl: "",
      guideUrl: "",
      supportVideo: false,
      commentShowEntrance: false,
    };
    return true;
  },
  "/moment/song/feed/get": (payload) => {
    if (!SETTINGS.CommentClean) return false;
    payload.event = [];
    payload.more = false;
    payload.size = 0;
    payload.cursor = 0;
    return true;
  },
  "/v1/user/info": (payload) => {
    if (!SETTINGS.MineClean) return false;
    let changed = false;
    if (payload.fmConfig !== null) {
      payload.fmConfig = null;
      changed = true;
    }
    if (payload.ticketConfig !== null) {
      payload.ticketConfig = null;
      changed = true;
    }
    return changed;
  },
  "/creator/musician/reminder/message/get": (payload) => {
    if (!SETTINGS.MineClean || !payload.data || payload.data.message === "")
      return false;
    payload.data.message = "";
    return true;
  },
  "/sp/flow/popup/query": (payload) => {
    if (!SETTINGS.AdClean || !payload.data) return false;
    payload.data = {};
    return true;
  },
  "/vipactivity/app/cashier/setting/get": (payload) => {
    if (!SETTINGS.AdClean || !payload.data?.cashierTabPopup) return false;
    payload.data.cashierTabPopup = {};
    return true;
  },
  "/link/position/show/resource": cleanSidebarResources,
  "/delivery/batch-deliver": (payload) => {
    // Slot 119 is the captured My-page membership promotion.
    if (
      !SETTINGS.MineClean ||
      !payload.data ||
      typeof payload.data !== "object" ||
      !(119 in payload.data)
    )
      return false;
    delete payload.data[119];
    return true;
  },
  "/link/scene/show/resource": cleanPlayerHints,
  "/link/scene/show/resource/scene-code/player": cleanPlayerHints,
  "/link/home/framework/tab": cleanBottomTabs,
  "/link/home/framework/top/tab": cleanTopTabs,
  "/homepage/block/page": cleanHomepageBanners,
  "/link/page/rcmd/resource/show": cleanHomeRecommendation,
  "/link/page/rcmd/block/resource/multi/refresh": (payload) => {
    if (!SETTINGS.HomeSimple) return false;
    if (!Array.isArray(payload.data)) return cleanHomeRecommendation(payload);
    const filtered = payload.data.filter((block) =>
      HOME_BLOCK_CODES.has(block?.blockCode),
    );
    if (filtered.length === payload.data.length) return false;
    payload.data = filtered;
    return true;
  },
};

function cleanInsertedResources(payload) {
  if (!SETTINGS.CommentClean) return false;
  const offset = Number(payload.data?.offset) || 0;
  payload.data = { count: 0, offset, records: [], delayRender: false };
  if (Array.isArray(payload.trp?.rules)) payload.trp.rules = [];
  return true;
}

function cleanSidebarResources(payload) {
  if (!SETTINGS.MineClean || !payload.data) return false;
  let changes = 0;
  const crossPosition = payload.data.crossPlatformResource?.positionCode;
  if (["MyPageBar", "MyPageBarRN"].includes(crossPosition)) {
    payload.data.crossPlatformResource = {};
    changes += 1;
  }
  const groups = Array.isArray(payload.data.dataGroupResourceList)
    ? payload.data.dataGroupResourceList
    : [];
  const isSidebarResponse = groups.some((group) =>
    String(group?.positionCode ?? "").startsWith("side_bar_new_"),
  );
  if (!isSidebarResponse) return changes > 0;

  const removedRuleIds = new Set(
    groups
      .filter((group) => SIDEBAR_ITEM_CODES.has(getSidebarItemCode(group)))
      .map((group) => group?.trp_id)
      .filter(Boolean),
  );
  const filteredGroups = groups.filter(
    (group) => !SIDEBAR_ITEM_CODES.has(getSidebarItemCode(group)),
  );
  if (filteredGroups.length !== groups.length) {
    payload.data.dataGroupResourceList = filteredGroups;
    changes += groups.length - filteredGroups.length;
  }
  changes += filterGeneralizedObjects(payload.data.commonResource);
  for (const resource of payload.data.commonResourceList ?? [])
    changes += filterGeneralizedObjects(resource);
  changes += clearSubtitles(payload.data.commonResource);
  changes += clearSubtitles(payload.data.commonResourceList);
  if (Array.isArray(payload.trp?.rules) && removedRuleIds.size) {
    const filteredRules = payload.trp.rules.filter(
      (rule) =>
        ![...removedRuleIds].some((id) => String(rule).includes(`::${id}::`)),
    );
    changes += payload.trp.rules.length - filteredRules.length;
    payload.trp.rules = filteredRules;
  }
  return changes > 0;
}

function cleanBottomTabs(payload) {
  if (
    !SETTINGS.BottomSimple ||
    !Array.isArray(payload.data?.commonResourceList)
  )
    return false;
  const filtered = payload.data.commonResourceList.filter(
    (tab) =>
      ["main", "mine"].includes(tab?.resourceType) ||
      ["首页", "我的"].includes(tab?.title),
  );
  if (filtered.length < 2) return false;
  let changed = filtered.length !== payload.data.commonResourceList.length;
  payload.data.commonResourceList = filtered;
  if (Array.isArray(payload.data.adminList) && payload.data.adminList.length) {
    payload.data.adminList = [];
    changed = true;
  }
  return changed;
}

function cleanTopTabs(payload) {
  if (!Array.isArray(payload.data?.commonResourceList)) return false;
  const original = payload.data.commonResourceList;
  let filtered = original.filter((tab) => {
    if (tab?.resCode === "fastPlay" || tab?.title === "心动") return true;
    const setting =
      TOP_TAB_SETTING_BY_CODE[tab?.resCode] ??
      TOP_TAB_SETTING_BY_TITLE[tab?.title];
    return Boolean(setting && SETTINGS[setting]);
  });
  if (!filtered.length) {
    const fallback =
      original.find(
        (tab) => tab?.resCode === "rcmd" || tab?.title === "推荐",
      ) ?? original[0];
    filtered = fallback ? [fallback] : [];
  }
  let changed =
    filtered.length !== original.length ||
    filtered.some((tab, index) => tab !== original[index]);
  payload.data.commonResourceList = filtered;
  const position = payload.data.positionConfig;
  if (position && typeof position === "object") {
    position.paramMap = { ...(position.paramMap ?? {}), composite: false };
    let params = {};
    if (typeof position.param === "string") {
      try {
        params = JSON.parse(position.param);
      } catch {
        params = {};
      }
    }
    position.param = JSON.stringify({ ...params, composite: false });
    changed = true;
  }
  for (const [field, value] of [
    ["hasMergeData", false],
    ["mrResultResourcesMap", null],
    ["filterPlanIdsMap", null],
    ["homeTopTabInfo", null],
    ["guideInfo", null],
  ]) {
    if (payload.data[field] !== value) {
      payload.data[field] = value;
      changed = true;
    }
  }
  if ("topTabStyle" in payload.data) {
    delete payload.data.topTabStyle;
    changed = true;
  }
  if (Array.isArray(payload.data.adminList) && payload.data.adminList.length) {
    payload.data.adminList = [];
    changed = true;
  }
  if (Array.isArray(payload.trp?.rules) && payload.trp.rules.length) {
    payload.trp.rules = [];
    changed = true;
  }
  return changed;
}

function cleanHomepageBanners(payload) {
  if (!SETTINGS.AdClean || !Array.isArray(payload.data?.blocks)) return false;
  let changed = false;
  for (const block of payload.data.blocks) {
    if (block?.showType !== "BANNER" || !Array.isArray(block.extInfo?.banners))
      continue;
    const filtered = block.extInfo.banners.filter(
      (banner) => !["活动", "广告"].includes(banner?.typeTitle),
    );
    if (filtered.length !== block.extInfo.banners.length) {
      block.extInfo.banners = filtered;
      changed = true;
    }
  }
  return changed;
}

function run() {
  try {
    const path = extractApiPath(globalThis.$request?.url ?? "");
    const handler = path ? HANDLERS[path] : null;
    const body = globalThis.$response?.body;
    if (
      !handler ||
      body === undefined ||
      body === null ||
      toBytes(body).length === 0
    )
      return $done({});
    const payload = decodeResponseBody(body);
    if (!handler(payload)) return $done({});
    return $done({ body: encodeResponseBody(payload) });
  } catch (error) {
    console.log(`[网易云音乐净化] 放行原响应：${error?.message ?? error}`);
    return $done({});
  }
}

run();

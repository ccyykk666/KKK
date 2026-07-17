/*
 * 微博轻享版响应净化
 * 依据 753/754 HAR 中的实际 JSON 字段处理，不修改评论正文。
 */

const url = $request.url;

if (!$response.body) {
  $done({});
} else {
  try {
    const body = JSON.parse($response.body);

    if (url.includes("/2/comments/build_comments")) {
      cleanCommentResponse(body);
    } else if (url.includes("/2/statuses/friends/timeline") ||
               url.includes("/2/statuses/unread_hot_timeline") ||
               url.includes("/2/statuses/container_timeline_hot") ||
               url.includes("/2/statuses/container_timeline_topic")) {
      cleanTimeline(body);
    } else if (url.includes("/2/statuses/container_detail")) {
      cleanContainerDetail(body);
    } else if (url.includes("/2/cardlist")) {
      cleanCardList(body);
    } else if (hasPortalAction(url, "discover_all")) {
      cleanDiscoverTabs(body);
    } else if (hasPortalAction(url, "trends")) {
      cleanDiscoverPage(body);
    } else if (hasPortalAction(url, "user_center")) {
      cleanUserCenter(body);
    }

    // HAR 753：用户对象的 icons 数组中 name="vip" 即昵称右侧会员图标。
    // 仅移除这一项，保留 verified 等黄 V/蓝 V 认证字段。
    cleanVipIcons(body);

    $done({ body: JSON.stringify(body) });
  } catch (_) {
    // 非 JSON 或结构变化时保留原响应，避免影响 App 正常使用。
    $done({});
  }
}

function hasPortalAction(requestUrl, action) {
  return new RegExp("[?&]a=" + action + "(?:&|$)").test(requestUrl);
}

function cleanCommentResponse(root) {
  walk(root, function (node) {
    // 这些 url_struct 会把普通评论词组渲染成带放大镜的蓝色搜索链接。
    if (Array.isArray(node.url_struct)) {
      node.url_struct = node.url_struct.filter(function (item) {
        const target = String(item && (item.ori_url || item.url || item.scheme) || "");
        const log = String(item && item.actionlog && item.actionlog.ext || "");
        return !target.includes("sinaweibo://searchall") &&
               !log.includes("search_high_lights:");
      });
      if (node.url_struct.length === 0) delete node.url_struct;
    }

    // 同步去掉搜索高亮分析标记，但保留作者、楼层、索引等正常分析信息。
    if (typeof node.analysis_extra === "string" &&
        node.analysis_extra.includes("search_high_lights:")) {
      node.analysis_extra = node.analysis_extra
        .split("|")
        .filter(function (part) { return !part.startsWith("search_high_lights:"); })
        .join("|");
    }

    // 保留原插件行为：若服务端下发该标记，将其置为已处理，阻止评论广告补位。
    if (Object.prototype.hasOwnProperty.call(node, "ad_from_comment")) {
      node.ad_from_comment = true;
    }
  });
}

function cleanTimeline(root) {
  delete root.advertises;
  delete root.ad;
  delete root.ad_version_2_weibo;

  if (Array.isArray(root.statuses)) {
    root.statuses = root.statuses.filter(function (status) {
      return !(status && status.ad_marked === true);
    });
  }

  if (Array.isArray(root.items)) {
    root.items = root.items.filter(function (item) {
      const status = item && (item.data || item.mblog);
      return !(status && status.ad_marked === true);
    });
  }
}

function cleanContainerDetail(root) {
  const items = root && root.pageHeader && root.pageHeader.data && root.pageHeader.data.items;
  if (Array.isArray(items)) {
    root.pageHeader.data.items = items.filter(function (item) {
      return !(item && item.data && item.data.itemid === "top_searching");
    });
  }
}

function cleanCardList(root) {
  if (!Array.isArray(root.cards)) return;
  root.cards = root.cards.filter(function (card) {
    if (card && card.mblog && card.mblog.ad_marked === true) return false;
    if (Array.isArray(card && card.card_group)) {
      card.card_group = card.card_group.filter(function (child) {
        return !(child && child.mblog && child.mblog.ad_marked === true);
      });
      if (card.card_group.length === 0) return false;
    }
    return true;
  });
}

function cleanDiscoverTabs(root) {
  if (!Array.isArray(root.data)) return;
  // “超话”Tab 由 native_topic 项下发；保留“趋势”和“热门”。
  root.data = root.data.filter(function (item) {
    return !(item && item.type === "native_topic");
  });
}

function cleanDiscoverPage(root) {
  const data = root && root.data;
  if (!data || typeof data !== "object") return;

  // 现有插件已处理的广告/足迹模块。
  delete data.banner;
  delete data.user_footprint;
  delete data.profile_accessrecord;
  delete data.native_content;

  // 截图中的 VIP/榜单/Nearby/世界杯/Topic 快捷入口整行。
  delete data.discover;

  // 截图底部 Hot Topic 模块；Search Trending 保留。
  delete data.topics;

  if (Array.isArray(data.order)) {
    const removed = new Set([
      "discover", "banner", "topics", "native_content",
      "user_footprint", "profile_accessrecord"
    ]);
    data.order = data.order.filter(function (name) { return !removed.has(name); });
  }
}

function cleanUserCenter(root) {
  const data = root && root.data;
  if (!data || !Array.isArray(data.cards)) return;

  // 会员推广、访客营销和低频装饰入口；保留设置、深色模式、收藏、赞、
  // 浏览记录、客服、草稿箱和屏蔽设置等实用功能。
  const removeTypes = new Set([
    "personal_vip",
    "ic_profile_wallpaper",
    "personal_accessrecord",
    "personal_topic",
    "personal_wallpaper"
  ]);

  data.cards.forEach(function (card) {
    if (!Array.isArray(card && card.items)) return;
    card.items = card.items.filter(function (item) {
      return !(item && removeTypes.has(item.type));
    });
  });

  data.cards = data.cards.filter(function (card) {
    return Array.isArray(card && card.items) && card.items.length > 0;
  });
}

function cleanVipIcons(root) {
  walk(root, function (node) {
    const isUserObject =
      typeof node.screen_name === "string" ||
      Object.prototype.hasOwnProperty.call(node, "mbtype") ||
      Object.prototype.hasOwnProperty.call(node, "mbrank");

    if (!isUserObject || !Array.isArray(node.icons)) return;

    node.icons = node.icons.filter(function (icon) {
      return String(icon && icon.name || "").toLowerCase() !== "vip";
    });
  });
}

function walk(value, visitor) {
  if (!value || typeof value !== "object") return;
  visitor(value);
  if (Array.isArray(value)) {
    value.forEach(function (item) { walk(item, visitor); });
  } else {
    Object.keys(value).forEach(function (key) { walk(value[key], visitor); });
  }
}

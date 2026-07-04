/*
 * JegoTrip response cleaner for Loon.
 *
 * The app mixes native, cached and server-driven UI. This script changes a
 * response only when it can identify a complete target group. Unrelated JSON,
 * destination APIs and non-JSON responses are returned untouched.
 */

(function () {
  "use strict";

  var responseBody = typeof $response !== "undefined" ? $response.body : "";
  var requestUrl =
    typeof $request !== "undefined" && $request.url ? $request.url : "";
  var requestBody =
    typeof $request !== "undefined" && $request.body ? $request.body : "";

  if (!responseBody) {
    $done({});
    return;
  }

  var root;
  try {
    root = JSON.parse(responseBody);
  } catch (error) {
    $done({});
    return;
  }

  function parseJson(value) {
    if (typeof value !== "string") return null;
    var trimmed = value.trim();
    if (
      !trimmed ||
      !(
        (trimmed.charAt(0) === "{" &&
          trimmed.charAt(trimmed.length - 1) === "}") ||
        (trimmed.charAt(0) === "[" &&
          trimmed.charAt(trimmed.length - 1) === "]")
      )
    ) {
      return null;
    }

    try {
      return JSON.parse(trimmed);
    } catch (error) {
      return null;
    }
  }

  var parsedRequestBody = parseJson(requestBody);
  var requestText = parsedRequestBody
    ? JSON.stringify(parsedRequestBody)
    : String(requestBody || "");

  // The user explicitly asked to leave destination and phone/message pages
  // unchanged. Destination assembly calls are recognized by their request
  // context as well as their dedicated paths.
  var protectedDestinationRequest =
    /\/api\/destination\//.test(requestUrl) ||
    /\/api\/layout\/v1\/init\/destinationModel(?:\?|$)/.test(requestUrl) ||
    /"pageCode"\s*:\s*"Destination"/i.test(requestText) ||
    /"componentParamVo"\s*:\s*\{[^}]*"destination"\s*:\s*\[[^\]]+\]/i.test(
      requestText
    );

  if (protectedDestinationRequest) {
    $done({});
    return;
  }

  var identityKeys = {
    name: true,
    title: true,
    label: true,
    text: true,
    tabName: true,
    columnName: true,
    moduleName: true,
    floorName: true,
    componentName: true,
    displayName: true,
  };

  var myRowLabels = {
    无忧币商城: true,
    任务中心: true,
    优惠券: true,
    购物车: true,
  };

  var personalPromoLabels = {
    邀请好友: true,
    领流量: true,
  };

  var changed = 0;

  function normalizeLabel(value) {
    return String(value == null ? "" : value)
      .replace(/\s+/g, "")
      .replace(/[：:]/g, "")
      .trim();
  }

  function addLabels(node, labels, depth) {
    if (node == null || depth > 6) return;

    if (Array.isArray(node)) {
      for (var index = 0; index < node.length; index += 1) {
        addLabels(node[index], labels, depth + 1);
      }
      return;
    }

    if (typeof node !== "object") return;

    var keys = Object.keys(node);
    for (var keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
      var key = keys[keyIndex];
      var value = node[key];

      if (
        identityKeys[key] &&
        (typeof value === "string" || typeof value === "number")
      ) {
        var label = normalizeLabel(value);
        if (label) labels[label] = true;
      }

      if (value && typeof value === "object") {
        addLabels(value, labels, depth + 1);
      } else if (typeof value === "string") {
        var nested = parseJson(value);
        if (nested) addLabels(nested, labels, depth + 1);
      }
    }
  }

  function labelsFor(node) {
    var labels = {};
    addLabels(node, labels, 0);
    return labels;
  }

  function countMatches(labels, expected) {
    var count = 0;
    var keys = Object.keys(expected);
    for (var index = 0; index < keys.length; index += 1) {
      if (labels[keys[index]]) count += 1;
    }
    return count;
  }

  function hasNearbyTab(labels) {
    var keys = Object.keys(labels);
    for (var index = 0; index < keys.length; index += 1) {
      if (/周边$/.test(keys[index])) return true;
    }
    return false;
  }

  function isHomeTabGroup(labels) {
    var markers = 0;
    if (hasNearbyTab(labels)) markers += 1;
    if (labels["全球景点"]) markers += 1;
    if (labels["无忧行宝典"]) markers += 1;
    return !!labels["推荐"] && markers >= 2;
  }

  function isPersonalPromoItem(labels) {
    return (
      countMatches(labels, personalPromoLabels) > 0 &&
      Object.keys(labels).length <= 12
    );
  }

  function isAdContainer(node) {
    if (!node || typeof node !== "object" || Array.isArray(node)) return false;
    if (normalizeLabel(node.componentName) === "广告位") return true;
    return false;
  }

  function isAdItem(node) {
    if (!node || typeof node !== "object" || Array.isArray(node)) return false;
    return (
      Number(node.adType) === 1 &&
      typeof node.imageUrl === "string" &&
      typeof node.action === "string"
    );
  }

  function cleanArray(array, depth) {
    var groupLabels = labelsFor(array);
    var myRowGroup = countMatches(groupLabels, myRowLabels) >= 3;
    var homeTabGroup = isHomeTabGroup(groupLabels);
    var output = [];

    for (var index = 0; index < array.length; index += 1) {
      var item = array[index];
      var itemLabels = labelsFor(item);
      var drop = false;

      // Remove a wrapper section containing the whole target group.
      if (
        countMatches(itemLabels, myRowLabels) >= 3 ||
        isHomeTabGroup(itemLabels)
      ) {
        drop = true;
      }

      // Remove the individual entries when the group itself is a flat array.
      if (
        !drop &&
        myRowGroup &&
        countMatches(itemLabels, myRowLabels) > 0
      ) {
        drop = true;
      }

      if (!drop && homeTabGroup) {
        if (
          itemLabels["推荐"] ||
          itemLabels["全球景点"] ||
          itemLabels["无忧行宝典"] ||
          hasNearbyTab(itemLabels)
        ) {
          drop = true;
        }
      }

      // These two labels uniquely identify the personal-page promotion cards.
      if (!drop && isPersonalPromoItem(itemLabels)) {
        drop = true;
      }

      if (!drop && (isAdContainer(item) || isAdItem(item))) {
        drop = true;
      }

      if (drop) {
        changed += 1;
      } else {
        output.push(cleanNode(item, depth + 1));
      }
    }

    return output;
  }

  function cleanObject(object, depth) {
    var keys = Object.keys(object);
    for (var index = 0; index < keys.length; index += 1) {
      var key = keys[index];
      var value = object[key];

      if (value && typeof value === "object") {
        object[key] = cleanNode(value, depth + 1);
        continue;
      }

      if (typeof value === "string") {
        var parsed = parseJson(value);
        if (parsed) {
          var changesBefore = changed;
          var cleaned = cleanNode(parsed, depth + 1);
          if (changed > changesBefore) {
            object[key] = JSON.stringify(cleaned);
          }
        }
      }
    }
    return object;
  }

  function cleanNode(node, depth) {
    if (node == null || depth > 20) return node;
    if (Array.isArray(node)) return cleanArray(node, depth);
    if (typeof node === "object") return cleanObject(node, depth);
    return node;
  }

  cleanNode(root, 0);

  if (changed > 0) {
    $done({ body: JSON.stringify(root) });
  } else {
    $done({});
  }
})();

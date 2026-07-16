// 京东标准版响应净化
// 保持 RuCu6 jingdong.js 的单脚本、URL 直接分支写法。

const url = $request.url;
const argumentValues =
  typeof $argument === "object" && $argument !== null ? $argument : {};
const argumentDefaults = {
  LaunchAds: true,
  HomeAds: true,
  NewPageAds: true,
  OrderAds: true,
  ProfileAds: true,
  SearchAds: true,
  ProductVideoAds: true,
  HomeBlocks: true,
  ProductPromos: false,
  CartRecommendations: true,
  ProductAI: true,
  MessageRecommendations: true,
  ProductRecommendations: true
};
const enabled = (name) => {
  const value = Object.prototype.hasOwnProperty.call(argumentValues, name)
    ? argumentValues[name]
    : argumentDefaults[name];
  return value === true || value === "true" || value === 1 || value === "1";
};
const rawRequestBody =
  typeof $request.body === "string" ? $request.body : "";
let decodedRequestBody = rawRequestBody;
try {
  decodedRequestBody = decodeURIComponent(rawRequestBody);
} catch (_) {}
const requestContext = `${rawRequestBody}\n${decodedRequestBody}`;

const clearRecommendResponse = (obj) => {
  if (Array.isArray(obj?.wareInfoList)) obj.wareInfoList = [];
  if (Array.isArray(obj?.tabs)) obj.tabs = [];
  if (obj?.tabTnInfo) obj.tabTnInfo = {};
  if (Object.prototype.hasOwnProperty.call(obj, "adIds")) obj.adIds = "";
  if (Object.prototype.hasOwnProperty.call(obj, "title")) delete obj.title;
  if (Object.prototype.hasOwnProperty.call(obj, "dmTitle")) delete obj.dmTitle;
};

if (!$response.body) {
  $done({});
} else {
  let obj = JSON.parse($response.body);

  if (
    enabled("OrderAds") &&
    (url.includes("functionId=deliverLayer") ||
      url.includes("functionId=orderTrackBusiness"))
  ) {
    // 物流页面：优惠横幅。
    if (obj?.bannerInfo) delete obj.bannerInfo;
    if (obj?.floors?.length > 0) {
      obj.floors = obj.floors.filter(
        (floor) => !["banner", "jdDeliveryBanner"].includes(floor?.mId)
      );
    }
  } else if (enabled("NewPageAds") && url.includes("functionId=getTabHomeInfo")) {
    // 新品页面：悬浮动图、下拉二楼。
    if (obj?.result?.iconInfo) delete obj.result.iconInfo;
    if (obj?.result?.roofTop) delete obj.result.roofTop;
  } else if (enabled("OrderAds") && url.includes("functionId=myOrderInfo")) {
    // 订单页面：横幅、常购推荐、PLUS 推广和精选特惠。
    const cleanOrderFloors = (floors) => {
      if (!Array.isArray(floors)) return floors;

      let newFloors = [];
      for (let floor of floors) {
        if (
          [
            "async_circleTopicFloor",
            "async_taro_contentGrassUpFloor",
            "bannerFloor",
            "bpDynamicFloor",
            "plusFloor"
          ].includes(floor?.mId)
        ) {
          continue;
        }

        if (floor?.mId === "virtualServiceCenter") {
          const centers = floor?.data?.virtualServiceCenters;
          if (centers?.length > 0) {
            for (let center of centers) {
              if (center?.serviceList?.length > 0) {
                center.serviceList = center.serviceList.filter(
                  (card) => card?.serviceTitle !== "精选特惠"
                );
              }
            }
          }
        }

        if (floor?.mId === "customerServiceFloor" && floor?.data?.moreText) {
          if (floor.data.moreIcon) delete floor.data.moreIcon;
          if (floor.data.moreIcon_dark) delete floor.data.moreIcon_dark;
          floor.data.moreText = " ";
        }

        newFloors.push(floor);
      }
      return newFloors;
    };

    // 旧版位于根节点；734 抓包中的新版位于 data.floors。
    obj.floors = cleanOrderFloors(obj?.floors);
    if (obj?.data) obj.data.floors = cleanOrderFloors(obj.data.floors);
  } else if (enabled("OrderAds") && url.includes("functionId=queryFloorDetailInfo")) {
    // 订单详情页：内容种草、PLUS 和专属权益楼层。
    const removeFloorIds = [
      "async_circleTopicFloor",
      "async_recommendFloor",
      "async_taro_contentGrassUpFloor",
      "bpDynamicFloor",
      "plusFloor"
    ];
    if (obj?.floors?.length > 0) {
      obj.floors = obj.floors.filter((floor) => {
        return (
          !removeFloorIds.includes(floor?.mId) &&
          floor?.data?.title !== "搭配推荐"
        );
      });
    }
    if (obj?.data?.floors?.length > 0) {
      obj.data.floors = obj.data.floors.filter((floor) => {
        return (
          !removeFloorIds.includes(floor?.mId) &&
          floor?.data?.title !== "搭配推荐"
        );
      });
    }
  } else if (enabled("OrderAds") && url.includes("functionId=newPurchaseWareCheck")) {
    // 订单列表中的“我的常购”。
    if (Object.prototype.hasOwnProperty.call(obj, "purchaseOrder")) {
      delete obj.purchaseOrder;
    }
    if (Object.prototype.hasOwnProperty.call(obj, "hitOrderHighPriceNewStyle")) {
      obj.hitOrderHighPriceNewStyle = 0;
    }
  } else if (enabled("OrderAds") && url.includes("functionId=queryListAsyncInfo")) {
    // 739 抓包：订单卡片下方的优惠券、PLUS 权益等营销引力条。
    // 该接口的 data 仅包含按订单 ID 组织的 guide，不影响订单主体。
    if (obj?.data && typeof obj.data === "object") {
      obj.data.guide = {};
    }
  } else if (enabled("OrderAds") && url.includes("functionId=newUserAllOrderList")) {
    // 734 抓包：订单页“秒送”旁的外卖图标，以及“服务”旁的搬家轮播图。
    const navigationTabs = obj?.listNavigationTabList;
    if (Array.isArray(navigationTabs)) {
      for (const tab of navigationTabs) {
        if (String(tab?.tabId) === "2") {
          // 保留“秒送”Tab，只清空右侧图标和动画素材。
          tab.tabIconUrl = "";
          tab.tabIconDarkUrl = "";
          tab.tabIconWidth = 0;
          tab.tabIconHeight = 0;
          tab.deliveryLottieMap = {};
          tab.deliveryLottieUrl = "";
          tab.iosDeliveryLottieUrl = "";
          tab.showDeliveryClose = false;
        } else if (String(tab?.tabId) === "3") {
          // 保留“服务”Tab，只清空右侧轮播营销图。
          tab.tabIconUrl = "";
          tab.tabIconDarkUrl = "";
          tab.tabIconWidth = 0;
          tab.tabIconHeight = 0;
          tab.carouselIconList = [];
          tab.carouselIconDarkList = [];
          tab.carouselNum = 0;
        }
      }
    }
  } else if (enabled("OrderAds") && url.includes("functionId=getGiftBuyEntryInfo")) {
    // 订单页右上角礼物入口：抓包只确认了 newMyOrder，属于尝试项。
    if (Object.prototype.hasOwnProperty.call(obj, "newMyOrder")) {
      obj.newMyOrder = false;
    }
    if (obj?.data && Object.prototype.hasOwnProperty.call(obj.data, "newMyOrder")) {
      obj.data.newMyOrder = false;
    }
  } else if (enabled("ProfileAds") && url.includes("functionId=personinfoBusiness")) {
    // “我的”页面。
    const removeFloorIds = [
      "bigSaleFloor",
      "buyOften",
      "marketTNFloor",
      "newAttentionCard",
      "newBigSaleFloor",
      "newCardFloor",
      "newStyleAttentionCard",
      "newsFloor",
      "noticeFloor",
      "recommendfloor",
      "simpleCardFloor"
    ];

    const cleanFloors = (floors) => {
      if (!Array.isArray(floors)) return floors;

      let newFloors = [];
      for (let floor of floors) {
        if (removeFloorIds.includes(floor?.mId)) continue;

        if (floor?.mId === "marketTNFloorNew") {
          const tnData = floor?.data?.tnData;

          // 734 抓包：nodes 是钱包/京东服务/互动游戏整块；
          // cardListStatic 是抽奖开红包。保留行为统计和物流卡片。
          if (Array.isArray(tnData?.nodes) || Array.isArray(tnData?.cardListStatic)) {
            continue;
          }

          // 头像卡右侧的学生会员推广，保留头像、会员等级等账户信息。
          if (tnData?.concisePlusInfo) delete tnData.concisePlusInfo;
          // 左上角“点评 每日签到”滚动快讯。
          if (tnData?.newsInfo) delete tnData.newsInfo;
        } else if (floor?.mId === "basefloorinfo") {
          if (floor?.data?.commonPopup) delete floor.data.commonPopup;
          if (floor?.data?.commonPopup_dynamic) delete floor.data.commonPopup_dynamic;
          if (floor?.data?.floatLayer) delete floor.data.floatLayer;
          if (floor?.data?.commonTips?.length > 0) floor.data.commonTips = [];
          if (floor?.data?.commonWindows?.length > 0) floor.data.commonWindows = [];
        } else if (floor?.mId === "orderIdFloor") {
          if (floor?.data?.commentRemindInfo?.infos?.length > 0) {
            floor.data.commentRemindInfo.infos = [];
          }
        } else if (floor?.mId === "userinfo") {
          if (floor?.data?.newPlusBlackCard) delete floor.data.newPlusBlackCard;
        }

        newFloors.push(floor);
      }
      return newFloors;
    };

    obj.floors = cleanFloors(obj?.floors);
    if (obj?.others) obj.others.floors = cleanFloors(obj.others.floors);
  } else if (enabled("LaunchAds") && url.includes("functionId=start")) {
    // 开屏广告。
    if (obj?.images?.length > 0) obj.images = [];
    if (Object.prototype.hasOwnProperty.call(obj, "showTimesDaily")) {
      obj.showTimesDaily = 0;
    }
  } else if (
    (enabled("HomeAds") || enabled("HomeBlocks")) &&
    url.includes("functionId=welcomeHome")
  ) {
    // 首页基础浮层，以及可单独控制的运营活动板块。
    let removeTypes = [];
    if (enabled("HomeAds")) {
      removeTypes.push(
        "bottomXview",
        "float",
        "photoCeiling",
        "ruleFloat",
        "searchIcon",
        "tabBarAtmosphere",
        "topRotate"
      );
    }
    if (enabled("HomeBlocks")) removeTypes.push("dynamicIcon", "hybrid");

    if (obj?.floorList?.length > 0) {
      obj.floorList = obj.floorList.filter(
        (floor) => !removeTypes.includes(floor?.type)
      );
    }
    if (enabled("HomeAds")) {
      if (obj?.webViewFloorList?.length > 0) obj.webViewFloorList = [];
      if (obj?.promotionTabs) delete obj.promotionTabs;

      // 740 抓包：首页顶部“秒送”Tab 右侧的外卖图片角标。
      const topTabs = obj?.multipleTabs?.content?.data;
      if (Array.isArray(topTabs)) {
        const deliveryTab = topTabs.find(
          (tab) => Number(tab?.id) === 495057
        );
        if (deliveryTab) {
          deliveryTab.labelNormal = "";
          deliveryTab.labelDark = "";
          deliveryTab.labelDeep = "";
          deliveryTab.keepLabel = 0;
          deliveryTab.labelWidth = 40;
        }
      }
    }
  } else if (enabled("SearchAds") && url.includes("functionId=clickRecommend")) {
    // 搜索结果中使用独立 Taro 模板渲染的 AI 推荐卡。
    if (obj?.data?.length > 0) {
      obj.data = obj.data.filter(
        (item) => !(item?.insertBizData && item?.tnTemplate)
      );
    }
  } else if (enabled("SearchAds") && url.includes("functionId=hotSearchTerms")) {
    // 734 抓包中首页顶部“作业帮”商业热词。
    if (obj?.data?.length > 0) {
      for (let group of obj.data) {
        if (!Array.isArray(group?.hotSearchContent)) continue;
        group.hotSearchContent = group.hotSearchContent.filter((item) => {
          const text = [item?.iconText, item?.title, item?.showWord]
            .filter(Boolean)
            .join(" ");
          return !text.includes("作业帮");
        });
      }
    }
  } else if (
    enabled("ProductVideoAds") &&
    url.includes("functionId=querySmallVideoWindow")
  ) {
    // 商品页右上角自动出现的小视频窗口。
    if (obj?.result?.contents?.length > 0) obj.result.contents = [];
  } else if (
    enabled("ProductAI") &&
    url.includes("functionId=aigc_guide")
  ) {
    // 741 抓包：商品主图“AI 使用说明”还会由独立引导接口下发。
    if (obj?.data && typeof obj.data === "object") obj.data = {};
  } else if (
    (enabled("ProductPromos") ||
      enabled("ProductAI") ||
      enabled("ProductVideoAds") ||
      enabled("ProductRecommendations")) &&
    url.includes("functionId=wareBusiness")
  ) {
    if (enabled("ProductVideoAds")) {
      // 741 抓包：“直播讲解”和“红包雨”共用 liveInfo 浮层数据。
      const data = obj?.commonBaseInfo?.data;
      if (data?.liveInfo) delete data.liveInfo;
      if (obj?.shareData?.statusInfo) {
        obj.shareData.statusInfo.livewindow = false;
      }
    }

    if (enabled("ProductAI")) {
      // 商品主图“AI 使用说明”及相关 AIGC 入口。
      const data = obj?.commonBaseInfo?.data;
      if (data) {
        if (Object.prototype.hasOwnProperty.call(data, "aigcFlag")) {
          data.aigcFlag = false;
        }
        if (Object.prototype.hasOwnProperty.call(data, "aigcFlagV2")) {
          data.aigcFlagV2 = false;
        }
        if (data.aigcFloorId) delete data.aigcFloorId;
        if (data.aigcBizInfo) delete data.aigcBizInfo;
        if (data?.daJiaPing?.floorQoList?.length > 0) {
          for (let item of data.daJiaPing.floorQoList) {
            if (Object.prototype.hasOwnProperty.call(item, "aiOverview")) {
              item.aiOverview = "0";
            }
          }
        }
      }
      for (let floor of obj?.floors || []) {
        if (floor?.data?.extMap?.mainPicAigcInfo) {
          delete floor.data.extMap.mainPicAigcInfo;
        }
      }
    }

    if (enabled("ProductRecommendations") && obj?.floors?.length > 0) {
      // 741 抓包：“为你推荐”和“潮流配件馆”同属 bpyxlc14 融合楼层。
      obj.floors = obj.floors.filter((floor) => floor?.mId !== "bpyxlc14");
    }

    if (enabled("ProductPromos")) {
      // 商品详情页非核心推广楼层；该开关默认关闭。
      const removeFloorIds = [
        "ActivityFloor",
        "bpAskCommunity",
        "bpGiveGifts",
        "bpdarenping14",
        "cardBenefitLx",
        "preferenceMore"
      ];
      if (obj?.floors?.length > 0) {
        obj.floors = obj.floors.filter(
          (floor) => !removeFloorIds.includes(floor?.mId)
        );
      }
    }
  } else if (enabled("ProductAI") && url.includes("functionId=queryEvaluateFloors")) {
    // 评价页“AI 全网评”，保留普通评价、标签和晒单。
    const result = obj?.result;
    if (result && typeof result === "object") {
      for (let section of Object.values(result)) {
        if (!section || typeof section !== "object") continue;
        if (Object.prototype.hasOwnProperty.call(section, "AIcomment")) {
          section.AIcomment = "0";
        }
        if (section.aiCommentInfo) delete section.aiCommentInfo;
        if (section?.commentIconInfo?.aiTitleIcon) {
          delete section.commentIconInfo.aiTitleIcon;
        }
        if (section?.commentIconInfo?.darkAiTitleIcon) {
          delete section.commentIconInfo.darkAiTitleIcon;
        }
        for (let listName of ["semanticTagList", "tagStatisticsinfoList"]) {
          for (let item of section?.[listName] || []) {
            if (item?.aiCommentInfo) delete item.aiCommentInfo;
          }
        }
      }
    }
  } else if (
    enabled("CartRecommendations") &&
    url.includes("functionId=uniformRecommend6")
  ) {
    // 738 抓包：uniformRecommend6 仅用于购物车 source=6 推荐商品流。
    clearRecommendResponse(obj);
  } else if (url.includes("functionId=uniformRecommend")) {
    const isOrderRecommend =
      requestContext.includes("JDOrderTest_p_detail") ||
      requestContext.includes("JDOrderTest_p_orderlist") ||
      ["2338", "4262"].includes(String(obj?.adIds || ""));
    const isMessageRecommend =
      requestContext.includes("NavigationBar_DeployButton") ||
      requestContext.includes('"source":101') ||
      String(obj?.adIds || "") === "50840" ||
      (Array.isArray(obj?.tabs) && obj?.tabTnInfo);

    if (
      (enabled("OrderAds") && isOrderRecommend) ||
      (enabled("MessageRecommendations") && isMessageRecommend)
    ) {
      clearRecommendResponse(obj);
    }
  }

  $done({ body: JSON.stringify(obj) });
}

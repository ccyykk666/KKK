// 大学搜题酱响应净化

const url = $request.url;
const argumentValues =
  typeof $argument === "object" && $argument !== null ? $argument : {};
const argumentDefaults = {
  HomeBadges: true,
  HomeGuide: true,
  SearchBanner: true,
  MinePromotions: true,
  CoinCenter: true,
  CoinRewardToast: false,
  PopupClean: true,
  SearchHotWords: true,
  AdConfig: true
};

const enabled = (name) => {
  const value = Object.prototype.hasOwnProperty.call(argumentValues, name)
    ? argumentValues[name]
    : argumentDefaults[name];
  return value === true || value === "true" || value === 1 || value === "1";
};

const clearCornerMarks = (items) => {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    if (item && typeof item === "object" && "cornerMarkPic" in item) {
      item.cornerMarkPic = "";
    }
  }
};

if (!$response.body) {
  $done({});
} else {
  try {
    const obj = JSON.parse($response.body);

    if (url.includes("/dxkits/aisearch/home")) {
      if (enabled("HomeBadges")) {
        clearCornerMarks(obj?.data?.aiPageBar);

        if (typeof obj?.data?.aiPageBarStr === "string") {
          try {
            const barConfig = JSON.parse(obj.data.aiPageBarStr);
            clearCornerMarks(barConfig?.bigDiamond);
            clearCornerMarks(barConfig?.smallDiamond);
            obj.data.aiPageBarStr = JSON.stringify(barConfig);
          } catch (_) {}
        }
      }

      if (enabled("SearchHotWords") && Array.isArray(obj?.data?.hotWords)) {
        obj.data.hotWords = [];
      }
    } else if (
      enabled("HomeGuide") &&
      url.includes("/dxkits/aisearch/guide")
    ) {
      if (obj?.data && typeof obj.data === "object") {
        obj.data.title = "";
        obj.data.guideList = [];
        obj.data.sugConfigList = [];
        obj.data.sugList = [];
        obj.data.guideBanner = {
          content: "",
          pic: "",
          btype: 0,
          bid: 0
        };
      }
    } else if (
      enabled("SearchBanner") &&
      url.includes("/dxapp/question/banner")
    ) {
      // 独立横幅接口：保留成功状态，只移除加密横幅负载。
      obj.data = {};
    } else if (url.includes("/dxapp/home/config")) {
      if (enabled("CoinCenter") && obj?.data) {
        obj.data.pointsCenter = 0;
        obj.data.materialCoinTaskUrl = "";
        obj.data.personalCoinTaskUrl = "";
      }

      if (enabled("AdConfig") && obj?.data) {
        obj.data.adSource = "";
        obj.data.psAdFreq = 0;
        if (obj.data.abResMap && typeof obj.data.abResMap === "object") {
          obj.data.abResMap.iOSAdSource = "";
        }
      }
    } else if (
      enabled("MinePromotions") &&
      url.includes("/capi/user/mine")
    ) {
      if (obj?.data && typeof obj.data === "object") {
        // PC 插件推广横幅。
        obj.data.bannerList = [];
        // VIP 卡片中的四项权益图标。
        obj.data.vipBenefitIntro = [];
        obj.data.vipCardConfig = {};
      }
    } else if (
      enabled("MinePromotions") &&
      url.includes("/viponline/college/mycard")
    ) {
      // 顶部“去开通 VIP”卡片来自独立会员接口。
      obj.data = {};
    } else if (
      enabled("CoinRewardToast") &&
      url.includes("/dxapp/pointsActivity/taskReport")
    ) {
      // 响应负载经过 App 私有加密；仅在用户主动打开开关时清空。
      obj.data = {};
    } else if (
      enabled("PopupClean") &&
      url.includes("/init/config/popupconfig")
    ) {
      if (obj?.data && typeof obj.data === "object") {
        obj.data.popupList = [];
        if (obj.data.vipSales) obj.data.vipSales.needShow = false;
        if (obj.data.subscriptionRenewalAlert) {
          obj.data.subscriptionRenewalAlert.isShow = false;
        }
        if (obj.data.vipRecall) obj.data.vipRecall.needRecall = false;
      }
    }

    $done({ body: JSON.stringify(obj) });
  } catch (_) {
    $done({});
  }
}

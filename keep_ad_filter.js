const url = $request.url;

function cleanMyPage(obj) {
  if (!obj?.data || typeof obj.data !== "object") return;

  obj.data.floatingInfo = {};
  delete obj.data.memberInfo;
}

function cleanBasicConfig(obj) {
  const data = obj?.data;
  if (!data || typeof data !== "object") return;

  const bottomBar = data.bottomBarControl;
  if (bottomBar && typeof bottomBar === "object") {
    bottomBar.defaultTab = "home";
    if (Array.isArray(bottomBar.tabs)) {
      const allowedTabs = new Set(["home", "dynamic_sports", "personal"]);
      bottomBar.tabs = bottomBar.tabs.filter((tab) =>
        allowedTabs.has(tab?.tabType)
      );
    }
  }

  data.homeTabs = [
    {
      type: "homeRecommend",
      order: 1,
      name: "推荐",
      schema: "keep://homepage/homeRecommend",
      showInFewDays: 7,
      reverseSwitch: false,
      default: true
    },
    {
      type: "homePrime",
      order: 2,
      name: "会员",
      schema: "keep://coursepage/homePrime",
      showInFewDays: 7,
      reverseSwitch: false,
      default: false
    }
  ];
}

function cleanCourseFeed(obj) {
  const modules = obj?.data?.modules;
  if (!Array.isArray(modules)) return;

  const blockedCodes = new Set(["homepageCommonContainer", "homepageLive"]);
  obj.data.modules = modules.filter(
    (module) => !blockedCodes.has(module?.code)
  );
}

function isAudioGuideTip(tipInfo) {
  if (!tipInfo || typeof tipInfo !== "object") return false;

  return (
    tipInfo.aiMode === "audioGuide" ||
    tipInfo.bizId === "audioGuide" ||
    String(tipInfo.cacheKey || "").endsWith("_audioGuide")
  );
}

function cleanRunningAudioGuide(obj) {
  const games = obj?.data?.games;
  if (!Array.isArray(games)) return;

  const runningTypes = new Set(["outdoorRunning", "indoorRunning"]);

  for (const game of games) {
    if (!runningTypes.has(game?.gameType) || !Array.isArray(game.microGames)) {
      continue;
    }

    for (const microGame of game.microGames) {
      const info = microGame?.leftIcon?.info;
      if (!info || typeof info !== "object") continue;

      if (Array.isArray(info.aimodes)) {
        const audioGuideSelected = info.aimodes.some(
          (mode) => mode?.aiMode === "audioGuide" && mode?.check === true
        );

        info.aimodes = info.aimodes.filter(
          (mode) => mode?.aiMode !== "audioGuide"
        );

        if (audioGuideSelected) {
          const normalMode = info.aimodes.find(
            (mode) => mode?.aiMode === "normal"
          );
          if (normalMode) {
            for (const mode of info.aimodes) {
              mode.check = mode === normalMode;
            }
          }
        }
      }

      if (isAudioGuideTip(info.tipInfo)) {
        delete info.tipInfo;
      }
    }
  }
}

if (!$response.body) {
  $done({});
} else {
  try {
    const obj = JSON.parse($response.body);

    if (/\/athena\/v\d+\/people\/(?:encrypt\/)?my(?:\?|$)/.test(url)) {
      cleanMyPage(obj);
    } else if (/\/config\/v\d+\/basic(?:\?|$)/.test(url)) {
      cleanBasicConfig(obj);
    } else if (/\/twins\/v4\/feed\/course(?:\?|$)/.test(url)) {
      cleanCourseFeed(obj);
    } else if (/\/pencil-webapp\/play\/v1\/games(?:\?|$)/.test(url)) {
      cleanRunningAudioGuide(obj);
    }

    $done({ body: JSON.stringify(obj) });
  } catch (error) {
    console.log(`Keep去广告：响应处理失败，放行原响应。${error}`);
    $done({});
  }
}

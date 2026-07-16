// 京东营销请求净化：返回结构正常的空 JSON，避免直接断网。

const body = JSON.stringify({
  code: "0",
  success: true,
  message: "",
  data: [],
  result: []
});

$done({
  response: {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store"
    },
    body
  }
});

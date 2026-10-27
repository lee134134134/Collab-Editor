/** 工作台统计 mock（npm start 开启 mock 时生效） */
export default {
  'GET /api/dashboard/stats': (req: any, res: any) => {
    res.json({
      items: [
        { label: '数据库工作流', value: 12 },
        { label: '今日会话数', value: 328 },
        { label: 'Token 消耗', value: '12.6 万' },
        { label: '请求成功率', value: '99.2%' },
        { label: '模型调用次数', value: 4512 },
        { label: '数据集条数', value: 1024 },
        { label: 'RAG 检索量', value: '3.4 万' },
        { label: '在线用户', value: 37 },
      ],
    });
  },
};

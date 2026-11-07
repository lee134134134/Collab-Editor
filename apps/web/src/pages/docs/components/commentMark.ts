import { Mark, mergeAttributes } from '@tiptap/core';

/**
 * 评论批注 Mark
 * - 渲染为带 data-comment-id / data-resolved 的 span
 * - 提供 setComment / setCommentResolved / unsetComment 命令
 */
export interface CommentMarkOptions {
  HTMLAttributes: Record<string, string | number | undefined>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    comment: {
      /**
       * 给当前选区添加批注 Mark
       */
      setComment: (attrs: { commentId: string }) => ReturnType;
      /**
       * 切换批注 Mark 的 resolved 状态
       */
      setCommentResolved: (attrs: {
        commentId: string;
        resolved: boolean;
      }) => ReturnType;
      /**
       * 移除批注 Mark
       */
      unsetComment: (attrs?: { commentId?: string }) => ReturnType;
    };
  }
}

export const CommentMark = Mark.create<CommentMarkOptions>({
  name: 'comment',
  inclusive: false,
  excludes: '',
  keepOnSplit: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-comment-id'),
        renderHTML: (attributes) => {
          if (!attributes.commentId) return {};
          return { 'data-comment-id': attributes.commentId };
        },
      },
      resolved: {
        default: false,
        parseHTML: (element) =>
          element.getAttribute('data-resolved') === 'true',
        renderHTML: (attributes) => {
          if (attributes.resolved === undefined || attributes.resolved === null)
            return {};
          return { 'data-resolved': String(attributes.resolved) };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-comment-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: `comment-mark ${HTMLAttributes['data-resolved'] === 'true' ? 'comment-mark--resolved' : ''}`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setComment:
        (attrs) =>
        ({ commands }) => {
          return commands.setMark(this.name, attrs);
        },
      setCommentResolved:
        (attrs) =>
        ({ commands, state }) => {
          const { tr } = state;
          const markType = state.schema.marks.comment;
          if (!markType) return false;

          let found = false;
          // 遍历文档找到所有匹配 commentId 的 mark 并更新 resolved
          tr.doc.descendants((node, pos) => {
            if (!node.isInline) return;
            node.marks.forEach((mark) => {
              if (
                mark.type === markType &&
                mark.attrs.commentId === attrs.commentId
              ) {
                found = true;
                const from = pos;
                const to = pos + node.nodeSize;
                tr.removeMark(from, to, markType);
                tr.addMark(
                  from,
                  to,
                  markType.create({
                    commentId: attrs.commentId,
                    resolved: attrs.resolved,
                  }),
                );
              }
            });
          });

          if (!found) return false;
          commands.setMeta('preventAutoscroll', true);
          return true;
        },
      unsetComment:
        (attrs) =>
        ({ state, dispatch }) => {
          const { tr, schema } = state;
          const markType = schema.marks.comment;
          if (!markType) return false;

          let found = false;
          tr.doc.descendants((node, pos) => {
            if (!node.isInline) return;
            node.marks.forEach((mark) => {
              if (
                mark.type === markType &&
                (!attrs?.commentId || mark.attrs.commentId === attrs.commentId)
              ) {
                found = true;
                tr.removeMark(pos, pos + node.nodeSize, markType);
              }
            });
          });

          if (!found) return false;
          if (dispatch) {
            tr.setMeta('preventAutoscroll', true);
            dispatch(tr);
          }
          return true;
        },
    };
  },
});

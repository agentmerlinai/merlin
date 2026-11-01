import { CodeBlock, CodeToken } from '@merlin/ui';

export const codeBlockShowcase = {
  id: 'code-block',
  title: 'CodeBlock',
  description: 'A quiet well for code and configuration. Token spans carry the syntax roles.',
  render: () => (
    <CodeBlock>
      <CodeToken token="cm">// one process, signed state</CodeToken>{'\n'}
      <CodeToken token="kw">export</CodeToken> <CodeToken token="kw">function</CodeToken>{' '}
      <CodeToken token="fn">createAgent</CodeToken>(config) {'{'}
      {'\n'}  <CodeToken token="kw">return</CodeToken> loop(
      <CodeToken token="str">'merlin'</CodeToken>, config);
      {'\n'}{'}'}
    </CodeBlock>
  ),
};

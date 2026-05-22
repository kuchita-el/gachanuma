import { Component, Fragment, type ReactNode } from 'react'
import ErrorComponent from '@/app/error'

type Props = {
  children: ReactNode
}

type State = {
  error?: Error
  renderKey: number
}

/**
 * テスト専用の Error Boundary。Next.js App Router の `app/error.tsx` 規約に従う
 * `ErrorComponent` をフォールバック UI として描画する。
 *
 * `reset` が呼ばれたとき `renderKey` をインクリメントして `<Fragment key>` で子要素を
 * 強制的に再 mount し、Next.js ランタイムが route segment を再構築する挙動を模す。
 * このため再 mount による form state クリアまでを spec で検証できる。
 *
 * Next.js 本番側の `reset` が同等の再構築を行うことを前提に依存しているため、
 * フレームワーク仕様変更時はここを追従する必要がある。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { renderKey: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  reset = (): void => {
    this.setState(prev => ({
      error: undefined,
      renderKey: prev.renderKey + 1,
    }))
  }

  render(): ReactNode {
    if (this.state.error) {
      return <ErrorComponent error={this.state.error} reset={this.reset} />
    }
    return <Fragment key={this.state.renderKey}>{this.props.children}</Fragment>
  }
}

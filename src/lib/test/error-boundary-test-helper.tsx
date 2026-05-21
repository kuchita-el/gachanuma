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
 * テスト専用の Error Boundary。本番 Next.js App Router の error.tsx の挙動を最小限再現する。
 * reset 時に renderKey を更新して子要素を再 mount し、フォーム state がクリアされた状態を再現する。
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

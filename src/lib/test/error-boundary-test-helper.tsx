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
 * テスト専用の Error Boundary。フォールバックに `app/error.tsx` の `ErrorComponent` を使う。
 *
 * `reset` で子要素をマウントし直し、Next.js が route segment を作り直す挙動をまねる。
 * Next.js の `reset` の挙動が変わったら、ここも合わせる必要がある。
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

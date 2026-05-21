import { Component, type ReactNode } from 'react'
import ErrorComponent from '@/app/error'

type Props = {
  children: ReactNode
}

type State = {
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {}

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  reset = (): void => {
    this.setState({ error: undefined })
  }

  render(): ReactNode {
    if (this.state.error) {
      return <ErrorComponent error={this.state.error} reset={this.reset} />
    }
    return this.props.children
  }
}

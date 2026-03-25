import React from 'react';
export class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <div style={{padding:20,textAlign:'center'}}>Something went wrong. <button onClick={()=>window.location.reload()}>Reload</button></div>;
    return this.props.children;
  }
}

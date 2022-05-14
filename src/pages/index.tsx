import * as React from "react"
import Main from "components/page/Main"
import useSiteStore from "store/site.store";

const IndexPage = () => {
  // TODO 🚧 TEMP HACK
  React.useEffect(() => useSiteStore.setState({ articleKey: 'objective' }) ,[]);
  
  return (
    <Main>
      Foo bar baz qux
    </Main>
  )
}

export default IndexPage

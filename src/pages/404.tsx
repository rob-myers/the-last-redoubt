import * as React from "react"
import { navigate } from "gatsby"

export default function NotFoundPage() {
  React.useEffect(() => {
    navigate('/');
  }, []);
}

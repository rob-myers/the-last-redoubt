import { Link } from "gatsby";
import React from "react";
import Icon from "./Icon";
import { cssName } from "projects/service/const";

export default function Aside(props: React.PropsWithChildren<{ title: string }>) {
    const id = getAsideId(props.title);
    return (
        <aside title={props.title}>
        <span {...props.title && { id }} className="anchor" />
        <Link to={`#${id}`}>
            <Icon icon="info-icon" invert className={cssName.ignoreDark} />
        </Link>
        {props.children}
        </aside>
    );
}

/** One article per page */
function getAsideId(
    asideName: string,
) {
    return `aside--${asideName}`;
}

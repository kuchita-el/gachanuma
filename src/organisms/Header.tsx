import React from "react";
import {AppBar, Toolbar, Typography} from "@mui/material";

export const Header = (props: { title: string }) => (
    <AppBar position={"static"}>
        <Toolbar>
            <Typography>{props.title}</Typography>
        </Toolbar>
    </AppBar>
);

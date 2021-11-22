import React from 'react';
import './App.css';
import {Header} from "./organisms/Header";
import {Container} from "@mui/material";
import ProbabilityForm from "./organisms/ProbabilityForm";

function App() {
    return (
        <div>
            <Header title={"マビ率は沼"}/>
            <Container>
                <ProbabilityForm/>
            </Container>
        </div>
    );
}

export default App;

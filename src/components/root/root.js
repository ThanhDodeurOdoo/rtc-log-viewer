const { Component } = owl;
import { Main } from "../main/main.js";

export class Root extends Component {
    static template = "Root";

    static components = { Main };
}

/**
 * Live reloading script.
 */

import * as React from 'react';
import { render } from 'react-dom';

import { BuildStatus } from './status';

render(React.createElement(BuildStatus, {}), document.getElementById('main'));

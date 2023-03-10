// Copyright (c) 2022 Siemens

/**
 * File for common configurator constants
 * @module js/pca0CommonConstants
 */
var exports = {};

export let CFG0CONFIGURATORPERSPECTIVE_POLICY = {
    types: [ {
        name: 'Cfg0ConfiguratorPerspective',
        properties: [ {
            name: 'cfg0ProductItems'
        }, {
            name: 'cfg0RuleSetEffectivity'
        }, {
            name: 'cfg0RevisionRule'
        }, {
            name: 'cfg0RuleSetCompileDate'
        } ]
    } ]
};

export let GRID_CONSTANTS = {
    CONSTRAINTS_GRID: 'constraintsGrid', // This one is common for top and bottom constrain grid dont use it until no options
    COMPACT_COLUMN_WIDTH: 50,
    MAX_COLUMN_WIDTH: 1000,
    BUSINESS_OBJECT_COLUMN_WIDTH: 50,
    CONSTRAINT_COLUMN_WIDTH: 150,
    MAX_SLIDER_COLUMN_WIDTH: 300
};

export default exports = {
    CFG0CONFIGURATORPERSPECTIVE_POLICY,
    GRID_CONSTANTS
};

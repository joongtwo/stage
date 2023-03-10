// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/pca0VariabilityExplorerConstants
 */
export const constants = {
    CLIENT_SCOPE_URI: {
        FEATURES: 'Pca0VariabilityExplorerFeatures',
        PRODUCTS: 'Pca0VariabilityExplorerProducts',
        VARIABILITY : 'Pca0VariabilityInConstraints'
    },
    PCA_CONSTRAINT_GRID_SETTINGS_PREFERENCE: 'PCA_constraint_grid_settings',
    CONFIG_CONTEXT_KEY: 'ConfiguratorCtx',
    CONFIG_CONTEXT_MAP: 'configuratorCtxMap',
    CONSTRAINTS_CONTEXT_KEY: 'ConstraintsCtx',
    CONSTRAINTS_EDITOR_SETTINGS: 'constraintsGridEditorSettings',

    GRID_CONSTANTS: {
        CONSTRAINTS: 'Constraints',
        CONSTRAINTS_EDITOR_TREE_CONTEXT: 'CONSTRAINTS_EDITOR_TREE_CONTEXT',
        DEFAULT_SETTINGS: {
            SHOW_PROPERTIES_INFORMATION_IN_GRID: false,
            TOP_TABLE_HEIGHT: 40,
            USE_COMPACT_COLUMN_WIDTH: false,
            COLUMN_WIDTH: 150,
            SHOW_SUBJECT_IN_TOP_GRID: true
        },
        CONSTRAINTS_PROP_INFO_NODE_UID: '__Pca0_Constraints_Properties_Section__',
        CONSTRAINTS_PROP_INFO_NODES: {
            TYPE_NODE_UID: 'object_type'
        },
        CONSTRAINTS_SUBJECT_NODE_UID: '__Pca0_Constraints_Subject_Section__',
        CONSTRAINTS_SUBJECT_EXPR_TYPE: 44,
        CONSTRAINTS_CONDITION_NODE_UID: '__Pca0_Constraints_Condition_Section__',
        CONSTRAINTS_CONDITION_EXPR_TYPE: 25,
        TOP_CONSTRAINTS_GRID: 'topConstraintsGrid',
        TOP_GRID_CONSTRAINTS_DP: 'topGridTreeDataProvider',
        BOTTOM_CONSTRAINTS_GRID: 'bottomConstraintsGrid',
        BOTTOM_GRID_CONSTRAINTS_DP: 'bottomGridTreeDataProvider'
    }
};

export default constants;

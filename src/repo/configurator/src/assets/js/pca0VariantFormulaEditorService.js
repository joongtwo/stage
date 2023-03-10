// Copyright (c) 2022 Siemens

/**
 * This module contain methods to author variant conditions in
 * Variant Formula Editor.
 *
 * @module js/pca0VariantFormulaEditorService
 */
import appCtxService from 'js/appCtxService';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import Pca0VCAUtils from 'js/pca0VCAUtils';
import dataSourceService from 'js/dataSourceService';
import editHandlerFactory from 'js/editHandlerFactory';
import editHandlerService from 'js/editHandlerService';

const subCtxEditKey = '.variantFormulaEditInProgress';
const subCtxEditKeyIsDirty = '.variantFormulaIsDirty';
const FORMULA_EDIT_CONTEXT = 'FORMULA_EDIT_CONTEXT';

/**
 * Sets the display formula in the editor for the selected object on which variant formula editor has been opened.
 * First check if display formula is cached, if not then retrieve it from getVariantFormulae soa.
 * @param {Object} subPanelContext - subpanel view model.
 * @returns {String} Display formula for the selected object.
 */
var getDisplayFormulaInEditor = function( subPanelContext ) {
    var configPerspectiveUid = subPanelContext.configPerspectiveUid;
    var formula = getVariantFormulaFromSelectedObj( subPanelContext );

    // get Cached display formula.
    var formulaMap = { ...appCtxService.getCtx( subPanelContext.contextKey + '.formulaEditorProps.cachedDisplayFormulaMap' ) };
    var displayFormula = '';
    if( formulaMap && formulaMap[ configPerspectiveUid ] && formulaMap[ configPerspectiveUid ][ formula ] ) {
        displayFormula = formulaMap[ configPerspectiveUid ][ formula ];
    } else {
        // Fire event to get display formula from soa and then set in
        // on variant formula editor.
        eventBus.publish( 'pca0VariantFormulaEditor.setDisplayFormulaInEditor' );
    }
    return displayFormula;
};

/**
 * Returns the variant formula for selected object from cache soaResponse in subPanelContext.
 * @param {Object} subPanelContext subPanel view model.
 * @returns {String} the variant formula for the selected object.
 */
var getVariantFormulaFromSelectedObj = function( subPanelContext ) {
    var selectedObject = { ...appCtxService.getCtx( subPanelContext.contextKey + '.formulaEditorProps.selectedObject' ) };
    return subPanelContext.selectedExpressions[ selectedObject.uid ][ 0 ].formula;
};

var setIsFormulaDirty = function( contextKey, isDirty ) {
    var allowConsumerAppsToLoadData = appCtxService.getCtx( 'variantConditionContext.allowConsumerAppsToLoadData' );
    if( allowConsumerAppsToLoadData ) {
        appCtxService.updatePartialCtx( contextKey + subCtxEditKeyIsDirty, isDirty );
    }
};

/**
 * Exports start here.
 */
var exports = {};

/**
 * Opens the variant formula editor if not already open, o.w. refresh editor properties.
 * @param {Object} commandContext - The ViewModel object.
 * @param {Object} contextKey - contextKey for app context where formula editor properties are stored.
 */
export var openVariantFormulaEditor = function( commandContext, contextKey ) {
    // Fetch formula editor properties store in app ctx for given contextKey.
    var formulaEditorProps = { ...appCtxService.getCtx( contextKey + '.formulaEditorProps' ) };
    if( !formulaEditorProps ) {
        formulaEditorProps = {};
    }
    var isRefreshRequired = false;
    if( formulaEditorProps.isFormulaEditorOpen ) {
        // If formula editor is already open, then refresh of editor properties is required.
        isRefreshRequired = true;
    } else {
        // Else open the formula editor.
        formulaEditorProps.isFormulaEditorOpen = true;
        formulaEditorProps.selectedObject = {};
    }
    // Get column on which formula editor has been opened.
    formulaEditorProps.selectedObject.uid = commandContext.gridContext.columnDef.uid;
    formulaEditorProps.selectedObject.displayName = commandContext.columnDef.displayName;

    // Update formula editor properties.
    appCtxService.updatePartialCtx( contextKey + '.formulaEditorProps', formulaEditorProps );

    if( isRefreshRequired ) {
        // Event to refresh editor properties.
        eventBus.publish( 'pca0VariantFormulaEditor.refresh' );
    }

    setIsFormulaDirty( contextKey, false );
};

/**
 * Discard edited changes and disable the editing of the Formula editor.
 * @param {Object} subPanelContext - Subpanel context view model object.
 * @param {Object} variantFormulaEditor - Formula editor properties set in view model.
 * @returns {Object} Returns updated variant formula editor properties.
 */
export let cancelEditVariantFormulaEditor = function( subPanelContext, variantFormulaEditor ) {
    // Notify edit handler to cancel edits
    var editHandler = editHandlerService.getEditHandler( FORMULA_EDIT_CONTEXT );
    editHandler.cancelEdits();

    // Reset editor properties
    appCtxService.updatePartialCtx( subPanelContext.contextKey + subCtxEditKey, false );
    var clonedVFEEProps = { ...variantFormulaEditor };
    clonedVFEEProps.dbValue = getVariantFormulaFromSelectedObj( subPanelContext );
    clonedVFEEProps.uiValue = getDisplayFormulaInEditor( subPanelContext );
    clonedVFEEProps.isEditable = false;
    setIsFormulaDirty( subPanelContext.contextKey, false );

    return clonedVFEEProps;
};

/**
 * Enable variant formula editor for editing.
 * @param {String} contextKey contextKey for app context used to store formula editor properties.
 * @returns {Boolean} True which is set on formula editor's isEditable property.
 */
export let startEditVariantFormulaEditor = function( contextKey ) {
    var editHandler = editHandlerService.getEditHandler( FORMULA_EDIT_CONTEXT );
    editHandlerService.setActiveEditHandlerContext( FORMULA_EDIT_CONTEXT );

    // Add to the appCtx about the editing state: alternative of setting editHandler.startEdit();
    // This way we are not using native edit mode template for cells
    editHandler._editing = true;

    // Set edit state in context
    setIsFormulaDirty( contextKey, true );
    appCtxService.updatePartialCtx( contextKey + subCtxEditKey, true );
    return true;
};

/**
 * Close the variant formula editor. Unsaved changes are handled by edit handler.
 * @param {String} contextKey contextKey for app context used to store formula editor properties.
 */
export let closeVariantFormulaEditor = function( contextKey ) {
    // Notify edit handler to cancel edits
    var editHandler = editHandlerService.getEditHandler( FORMULA_EDIT_CONTEXT );
    editHandler.cancelEdits();

    // Reset editor properties
    appCtxService.updatePartialCtx( contextKey + subCtxEditKey, false );

    // Fetch formula editor properties store in app ctx for given contextKey.
    var formulaEditorProps = { ...appCtxService.getCtx( contextKey + '.formulaEditorProps' ) };
    formulaEditorProps.isFormulaEditorOpen = false;
    formulaEditorProps.selectedObject = {};
    appCtxService.updatePartialCtx( contextKey + '.formulaEditorProps', formulaEditorProps );

    setIsFormulaDirty( contextKey, false );
};

/**
 * Post processing of successful variant formula save.
 * It resets edit command visibility in PWA and in VCA and disables edit mode of Formula Editor.
 * @param {String} contextKey contextKey for app context used to store formula editor properties.
 */
export var postProcessSaveVariantFormula = function( contextKey ) {
    var editHandler = editHandlerService.getEditHandler( FORMULA_EDIT_CONTEXT );
    editHandler.cancelEdits();

    // // Reset editor properties
    appCtxService.updatePartialCtx( contextKey + subCtxEditKey, false );
};

/**
 * Sets the display formula in the editor retrieved by getVariantFormulae SOA.
 * Caches the response as well.
 * @param {Object} subPanelContext - sub panel context data.
 * @param {Object} soaResponse - getVariantFormulae SOA Response.
 * @returns {String} Returns display formula fetched by soa.
 */
export var postProcessSetDisplayFormulaeInEditor = function( subPanelContext, soaResponse ) {
    var displayFormula = '';
    var configPerspectiveUid = subPanelContext.configPerspectiveUid;
    var formula = getVariantFormulaFromSelectedObj( subPanelContext );
    if( soaResponse.formulae[ 0 ].displayFormula ) {
        displayFormula = soaResponse.formulae[ 0 ].displayFormula;
        var displayFormulaMap = { ...appCtxService.getCtx( subPanelContext.contextKey + '.formulaEditorProps.cachedDisplayFormulaMap' ) };
        if( !displayFormulaMap ) {
            displayFormulaMap = [];
        }
        if( !displayFormulaMap[ configPerspectiveUid ] ) {
            displayFormulaMap[ configPerspectiveUid ] = [];
        }
        // Cache the display Formula
        displayFormulaMap[ configPerspectiveUid ][ formula ] = displayFormula;
        appCtxService.updatePartialCtx( subPanelContext.contextKey + '.formulaEditorProps.cachedDisplayFormulaMap', displayFormulaMap );
    }
    return displayFormula;
};

/**
 * Initialized formula editor properties such as Display name, variant formula and display formula.
 * Close the editor if selected object is no longer available.
 * @param {Object} subPanelContext sub panel context data.
 * @param {Object} variantFormulaEditor  Formula editor properties set in view model.
 * @returns {Object} returns updated variant formula editor properties.
 */
export var initializeEditorProps = function( subPanelContext, variantFormulaEditor ) {
    var contextKey = subPanelContext.contextKey;
    var selectedObject = { ...appCtxService.getCtx( contextKey + '.formulaEditorProps.selectedObject' ) };
    var localeTextBundle = localeService.getLoadedText( 'ConfiguratorMessages' );
    if( selectedObject.uid && subPanelContext.selectedExpressions[ selectedObject.uid ] ) {
        var clonedVFEEProps = { ...variantFormulaEditor };
        var formula = getVariantFormulaFromSelectedObj( subPanelContext );
        clonedVFEEProps.dbValue = formula;
        clonedVFEEProps.uiValue = getDisplayFormulaInEditor( subPanelContext );
        clonedVFEEProps.propertyDisplayName = selectedObject.displayName + ' ' + localeTextBundle.aw_Element + ':';
        clonedVFEEProps.isEditable = false;
        return { contextKey: contextKey, initialFormula: formula, variantFormulaEditor: clonedVFEEProps };
    }
    // show popup that editor is will close.
    messagingService.showInfo( localeTextBundle.closingVariantFormulaEditorMessage.replace( '{0}', selectedObject.displayName ) );
    // Close editor.
    closeVariantFormulaEditor( contextKey );
};

/**
 * Initialzed edit and save handlers. Edit/Save handlers help detect unsaved edits
 * (when changing selection in primary workarea or navigating to another tab)
 * and handle cancel/save actions.
 * @param {Object} declViewModel View model object.
 */
export let initializeEditHandler = function( declViewModel ) {
    // Edit Handler
    var editHandler = editHandlerFactory.createEditHandler( dataSourceService
        .createNewDataSource( {
            declViewModel: declViewModel
        } ) );

    // Add new method to identify editing context
    editHandler.getEditHandlerContext = function() {
        return FORMULA_EDIT_CONTEXT;
    };

    editHandlerService.setEditHandler( editHandler, FORMULA_EDIT_CONTEXT );
    editHandlerService.setActiveEditHandlerContext( FORMULA_EDIT_CONTEXT );
};

/**
 * Return custom save Handler (as per contribution saveHandlers.json)
 * @return {Object} save handler
 */
export let getSaveHandler = function() {
    // Save Handler
    return {
        isDirty: function( datasource ) {
            var declViewModel = datasource.getDeclViewModel().getData();
            return declViewModel.variantFormulaEditor.dbValue !== declViewModel.initialFormula;
        },
        saveEdits: function( /*datasource, inputs*/ ) {
            eventBus.publish( 'pca0VariantFormulaEdit.editModeChanged', { editOperation: 'save' } );
        },
        cancelEdits: function() {
            eventBus.publish( 'pca0VariantFormulaEdit.editModeChanged', { editOperation: 'cancel' } );
        }
    };
};

/**
 * Return uid of the selected object in formula editor.
 * @param {String} contextKey contextKey for app context used to store formula editor properties.
 * @returns {String} Uid of the selected object.
 */
export var getSelectedObjUid = function( contextKey ) {
    var selectedObjUid = '';
    var selectedObject = { ...appCtxService.getCtx( contextKey + '.formulaEditorProps.selectedObject' ) };
    if( selectedObject && selectedObject.uid ) {
        selectedObjUid = selectedObject.uid;
    }
    return selectedObjUid;
};

/**
 * Service to operate variant formula editor.
 */
export default exports = {
    openVariantFormulaEditor,
    startEditVariantFormulaEditor,
    cancelEditVariantFormulaEditor,
    closeVariantFormulaEditor,
    postProcessSaveVariantFormula,
    postProcessSetDisplayFormulaeInEditor,
    initializeEditorProps,
    initializeEditHandler,
    getSaveHandler,
    getSelectedObjUid
};

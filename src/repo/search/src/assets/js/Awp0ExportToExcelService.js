// Copyright 2019 Siemens Product Lifecycle Management Software Inc.

/**
 * logic surrounding exporting search results to excel
 * @module js/Awp0ExportToExcelService
 */

import appCtxService from 'js/appCtxService';
import localeService from 'js/localeService';
import _ from 'lodash';
import { DerivedStateResult } from 'js/derivedContextService';

let selectedResultsText = '';
let asShownTabNameText = '';
let templateTabNameText = '';

/**
 * Load the export tabs and create export selection dynamically
 * @param {Object} data - The view model data
 * @param {String} asShown - The localized string for AsShown
 * @param {string} template - The localized string for Template
 */
export let createExportPanel = () => {
    return [ new DerivedStateResult( {
        ctxParameters: [],
        additionalParameters: [],
        compute: ( renderContext ) => {
            let tabs = [];

            let asShownTab = {
                name: asShownTabNameText,
                tabKey: 'searchExport',
                pageId: asShownTabNameText,
                recreatePanel: true
            };
            let templateTab = {
                name: templateTabNameText,
                tabKey: 'template',
                pageId: templateTabNameText,
                view: 'Arm0ExportToOfficeAppSub',
                panelId: 'Arm0ExportToOfficeAppSub',
                recreatePanel: true
            };

            let selectedObjects = appCtxService.getCtx( 'mselected' );
            let selectedObject = appCtxService.getCtx( 'selected' );
            let clientScopeURI = appCtxService.getCtx( 'sublocation.clientScopeURI' );
            let hasSelected = selectedObjects && selectedObjects.length > 0;
            let isSearchLocation = clientScopeURI === 'Awp0SearchResults' || clientScopeURI === 'Awp0AdvancedSearch';

            if( isSearchLocation ) {
                tabs.push( asShownTab );
            }

            if( hasSelected ) {
                let isWSOSelected = selectedObject.modelType && selectedObject.modelType.typeHierarchyArray.indexOf( 'WorkspaceObject' ) > -1;
                if( isWSOSelected ) {
                    tabs.push( templateTab );
                }
            }
            return tabs;
        }
    } ) ];
};

/**
 * create the Export panel when reveal
 * @param {Object} data - The view model data
 * @param {String} asShown - The localized string for AsShown
 * @param {string} template - The localized string for Template
 */
export let revealExportPanel = ( data, asShown, template ) => {};

/**
 * update the Export panel based on selection dynamically
 * @param {Object} data - The view model data
 * @param {String} asShown - The localized string for AsShown
 * @param {string} template - The localized string for Template
 */
export let reCreateViewModelForSelect = ( data ) => {};

export let initializeExportTypes = ( exportType ) => {
    let updatedExportTypeProp = _.cloneDeep( exportType );
    let searchExportMaxRows = appCtxService.getCtx( 'preferences.AW_Search_Results_Export_Max_Rows' );
    updatedExportTypeProp.propertyRadioTrueText = searchExportMaxRows[ 0 ];
    updatedExportTypeProp.propertyRadioFalseText = selectedResultsText;
    return updatedExportTypeProp;
};

export let initializeSearchType = ( historyNameToken ) => {
    return historyNameToken;
};

let loadConfiguration = () => {
    localeService.getTextPromise( 'SearchMessages', true ).then(
        function( localTextBundle2_ ) {
            selectedResultsText = localTextBundle2_.selectedResults;
            asShownTabNameText = localTextBundle2_.asShownTabTitle;
            templateTabNameText = localTextBundle2_.templateTabTitle;
            let searchExportMaxRows = appCtxService.getCtx( 'preferences.AW_Search_Results_Export_Max_Rows' );
            if( searchExportMaxRows && searchExportMaxRows.length > 0 ) {
                let formattedTextForAllResults = localTextBundle2_.allResults.format( searchExportMaxRows[ 0 ] );
                appCtxService.updatePartialCtx( 'preferences.AW_Search_Results_Export_Max_Rows', [ formattedTextForAllResults ] );
            } else {
                let formattedTextForAllResults = localTextBundle2_.allResults.format( 1000 );
                appCtxService.updatePartialCtx( 'preferences.AW_Search_Results_Export_Max_Rows', [ formattedTextForAllResults ] );
                console.error( 'The preference \'AW_Search_Results_Export_Max_Rows\' is not set in this environment. The display value is the default value.' );
            }
        } );
};

loadConfiguration();

/* eslint-disable-next-line valid-jsdoc*/

const Awp0ExportToExcelService = {
    createExportPanel,
    revealExportPanel,
    reCreateViewModelForSelect,
    initializeExportTypes,
    initializeSearchType
};

export default Awp0ExportToExcelService;

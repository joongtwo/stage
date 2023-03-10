// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import cdm from 'soa/kernel/clientDataModel';
import epTableService from 'js/epTableService';
import { constants as epLoadConstants } from 'js/epLoadConstants';
import mfeViewModelUtils from 'js/mfeViewModelUtils';
import _ from 'lodash';

/**
 * Tabs Service for EasyPlan.
 *
 * @module js/epTabsService
 */

/**
 * Set the tab display name with its contentCount (number of object displayed in the tab content) in parenthesis
 *
 * @param {Object} tabData - the tabs data as json object
 * @returns {Object} updated tab data
 */
export function setTabDisplayNameWithQuantity( tabData ) {
    if( tabData ) {
        tabData.namePrefix = !tabData.namePrefix ? tabData.name : tabData.namePrefix;
        tabData.name = !tabData.contentCount || tabData.contentCount === 0 || tabData.contentCount === '0' ? tabData.namePrefix : `${tabData.namePrefix} (${tabData.contentCount})`;
    }
    return tabData;
}

/**
 * addCountAndTotalToTabTitle
 * This method sets title for tab, including total count. For example Time Management (2 out of 6 activities)
 * 2 is the count, 6 is the total count
 *
 * @param {Object} tabData tab data
 * @param {Integer} count count
 * @param {Integer} totalCount total object count
 * @param {String} messageToFormat  messageToFormat
 */
export function addCountAndTotalToTabTitle( tabData, count, totalCount, messageToFormat ) {
    if( !tabData ) {
        return;
    }
    let updatedTabData = { ...tabData };
    updatedTabData.contentCount = count;
    let countLabel = messageToFormat;
    countLabel = countLabel.replace( '{0}', updatedTabData.contentCount );
    countLabel = countLabel.replace( '{1}', totalCount );
    updatedTabData.tabs[ 0 ].name = updatedTabData.name + countLabel;
    mfeViewModelUtils.mergeValueInAtomicData( tabData, updatedTabData );
}

/**
 * resetTabTitle
 * This method sets tile for activities
 * @param {Object} tabData tab data
 */
export function resetTabTitle( tabData ) {
    if( !tabData ) {
        return;
    }
    let updatedTabData = { ...tabData };
    updatedTabData.tabs[ 0 ].name = updatedTabData.name;
    mfeViewModelUtils.mergeValueInAtomicData( tabData, updatedTabData );
}

/**
 * Get list of tabs that should display their contentCount (number of object displayed in the tab content)
 * in parenthesis next to their display name
 *
 * @param {Object} contentPanelData - the content panel ( having the tabs ) data as json object
 */
export function getListOfTabsToDisplayNameWithQuantity( contentPanelData ) {
    contentPanelData.displayNameWithQuantityTabs = contentPanelData.tabs.filter( tab => tab.loadInputObject );
}

/**
 * Get list of properties to load in order to have each tab contentCount (number of object displayed in the tab content)
 *
 * @param {Object} contentPanelData - the content panel ( having the tabs ) data as json object
 */
export function getAllPropertiesToLoad( contentPanelData ) {
    contentPanelData.allPropertiesToLoad = [];
    contentPanelData.allLoadTypes = [ epLoadConstants.GET_PROPERTIES ];
    contentPanelData.displayNameWithQuantityTabs.forEach( ( tab ) => {
        tab.loadInputObject.propertiesToLoad && contentPanelData.allPropertiesToLoad.push( ...tab.loadInputObject.propertiesToLoad );
        tab.loadInputObject.additionalPropertiesToLoad && contentPanelData.allPropertiesToLoad.push( ...tab.loadInputObject.additionalPropertiesToLoad );
        tab.loadInputObject.loadTypes && contentPanelData.allLoadTypes.push( ...tab.loadInputObject.loadTypes );
    } );
}

/**
 * Init all the relevant tabs contentCount
 *
 * @param {Object} tabsData - the tabs data as json object
 */
function initTabsContentCount( tabsData ) {
    tabsData.forEach( ( tabData ) => {
        tabData.namePrefix = !tabData.namePrefix ? tabData.name : tabData.namePrefix;
        tabData.contentCount = 0;
        tabData.name = tabData.namePrefix;
    } );
}

/**
 * In case an object is selected to display its related data in the details tabs than,
 * Calculate the number of objects to display in each tab to, display in parenthesis next to the tab display name.
 * In case no object to display its related data in tabs is selected, or more than one object is selected than,
 * Don't display anything next to the tab display name
 *
 * @param {String} objUid - the object uid to load its related data to display in tabs
 * @param {Object} contentPanelData - the tabs data as json object
 * @returns {Promse} a promise object
 */
export function calculateContentCountForEachTab( objUid, contentPanelData ) {
    let clonedContentPanelData = _.cloneDeep( contentPanelData );
    if( objUid ) {
        return epTableService.loadAllProperties( objUid, clonedContentPanelData.allPropertiesToLoad, clonedContentPanelData.allLoadTypes ).then( ( response ) => {
            const modelObject = cdm.getObject( objUid );
            clonedContentPanelData.displayNameWithQuantityTabs.forEach( ( tabData ) => {
                tabData.contentCount = 0;
                const propertiesToLoad = tabData.loadInputObject.propertiesToLoad;
                if( modelObject.props[ propertiesToLoad ] ) {
                    tabData.contentCount += modelObject.props[ propertiesToLoad ].dbValues ? modelObject.props[ propertiesToLoad ].dbValues.length : 0;
                    tabData.contentData = modelObject.props[ propertiesToLoad ].dbValues ? modelObject.props[ propertiesToLoad ].dbValues : '';
                }
                const objMapKeys = tabData.loadInputObject.loadedObjectMapKeys;

                if( objMapKeys && response.loadedObjectsMap && response.loadedObjectsMap[ objMapKeys ] ) {
                    tabData.contentCount += response.loadedObjectsMap[ objMapKeys ].length;
                }

                const relatedObjectMapKey = tabData.loadInputObject.relatedObjectMapKey;
                if( response.relatedObjectsMap && relatedObjectMapKey ) {
                    const additionalPropertiesMap = response.relatedObjectsMap[ objUid ] && response.relatedObjectsMap[ objUid ].additionalPropertiesMap2;
                    if( Array.isArray( relatedObjectMapKey ) ) {
                        relatedObjectMapKey.forEach( prop => {
                            if( additionalPropertiesMap[ prop ] ) {
                                tabData.contentCount += additionalPropertiesMap[ prop ].length;
                            }
                        } );
                    } else if( additionalPropertiesMap[ relatedObjectMapKey ] ) {
                        tabData.contentCount += additionalPropertiesMap[ relatedObjectMapKey ].length;
                    }
                }
                setTabDisplayNameWithQuantity( tabData );
            } );
            return clonedContentPanelData;
        } );
    }
    if( clonedContentPanelData.displayNameWithQuantityTabs ) {
        initTabsContentCount( clonedContentPanelData.displayNameWithQuantityTabs );
    }
    return new Promise( ( res ) => res( clonedContentPanelData ) );
}
/**
 * set Icon On Tab
 *
 * @param { ObjectArray } contentPanelData: content panel data with tabs details
 *   e.g: "tabs": [{
 *                   "name": "Process Tab",
 *                   "tabKey": "epProcess"
 *              }]
 * @param { String } tabKey: on which tab out of tabData we want to show icon
 * @param { Boolean } shouldBeVisible: whether to set icon or unset icon
 * @param { String } iconName: which icon to set
 * @returns { ObjectArray } updated content panel data
 */
export function setIconOnTab( contentPanelData, tabKey, shouldBeVisible, iconName ) {
    let clonedContentPanelData = _.cloneDeep( contentPanelData );
    clonedContentPanelData.tabs.forEach( ( tab ) => {
        if( tab.tabKey === tabKey ) {
            tab.iconId = shouldBeVisible ? iconName : '';
        }
    } );
    return clonedContentPanelData;
}

/**
 * Set label on tab
 * @param { ObjectArray } contentPanelData: content panel data with tabs details
 *   e.g: "tabs": [{
 *                   "name": "Process Tab",
 *                   "tabKey": "epProcess"
 *              }]
 * @param { String } tabKey: on which tab out of tabData we want to show icon
 * @param {String} name the text of the label
 * @returns { ObjectArray } updated content panel data
 */
export function setLabelOnTab( contentPanelData, tabKey, name, namePrefix ) {
    let clonedContentPanelData = _.cloneDeep( contentPanelData );
    clonedContentPanelData.tabs.forEach( ( tab ) => {
        if( tab.tabKey === tabKey ) {
            tab.name = name;
            if ( namePrefix ) {
                tab.namePrefix = namePrefix;
            }
        }
    } );
    return clonedContentPanelData;
}

/**
 * Update the Tab Model as per the condition based on the structure type
 * @param {Object} tabsData - the tabs data as json object
 * @param {Array} tabsToBeRemoved - array of tab keys
 * @return {Object} updated tab data
 */
export function removeTabs( tabsData, tabsToBeRemoved ) {
    let clonedTabsData = _.cloneDeep( tabsData );
    let filteredTabs = tabsData.tabs.filter( tab => !tabsToBeRemoved.includes( tab.tabKey ) );
    clonedTabsData.tabs = filteredTabs;
    return clonedTabsData;
}

/**
 * Get the input object for the details table, based on the parameters:
 * If there is an input object on the sync port and the object type isn't excluded, return it.
 * Otherwise return empty string.
 *
 * @param {*} portsEpDetailsInputObject input object from the sync port
 * @param {*} excludeInputTypes types that aren't appropriate for this details table, as should be defined in the containing view.
 * @returns {*} the appropriate input object
 */
export function getValidInputForDetailsTable( portsEpDetailsInputObject, excludeInputTypes ) {
    // if there was an input object on the subpanel context on init, return it.
    if( portsEpDetailsInputObject && portsEpDetailsInputObject.uid ) {
        if( !excludeInputTypes ) {
            return portsEpDetailsInputObject;
        }
        // else need to check if the type needs to be excluded.
        let isTypeToExclude = false;
        excludeInputTypes.forEach( element => {
            if( portsEpDetailsInputObject.modelType.typeHierarchyArray.includes( element ) ) {
                isTypeToExclude = true;
            }
        } );
        if( !isTypeToExclude ) {
            return portsEpDetailsInputObject;
        }
    }
    // else
    return '';
}

/**
 * updates a tab in the list of tabs according to a new tabKey given as an input
 *
 * @param {Object[]} tabs tabs objects list
 * @param {String} currentTabKey the current value of tabKey
 * @param {String} newTabKey the new value of tabKey
 * @returns {Object[]} the updated tabs objects list
 */
export function updateTabKeyInTabsArray( tabs, currentTabKey, newTabKey ) {
    const tabIndex = tabs.findIndex( ( tab ) => tab.tabKey === currentTabKey );
    if ( tabIndex !== -1 ) {
        tabs[ tabIndex ].tabKey = newTabKey;
    }
    return tabs;
}

const exports = {
    setTabDisplayNameWithQuantity,
    addCountAndTotalToTabTitle,
    resetTabTitle,
    getListOfTabsToDisplayNameWithQuantity,
    getAllPropertiesToLoad,
    calculateContentCountForEachTab,
    setIconOnTab,
    setLabelOnTab,
    removeTabs,
    getValidInputForDetailsTable,
    updateTabKeyInTabsArray
};

export default exports;

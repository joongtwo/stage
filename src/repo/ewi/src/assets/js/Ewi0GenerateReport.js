// Copyright (c) 2022 Siemens

/**
 * @module js/Ewi0GenerateReport
 */
import listBoxSvc from 'js/listBoxService';
import ewiService from 'js/ewiService';


/**
 * Get the current step uid.
 *
 * @return {String} the current step uid.
 */
export function getSelectedBusinessObjectUid() {
    return ewiService.getCurrentStep().uid;
}

/**
 * Extract the exact report format preference name.
 *
 * @param{Boolean} isFullReport - true if Full Work package Report else CurrentStep.
 * @return {String} report format preference name.
 */
export function getFormatPreferenceName( isFullReport ) {
    let preferenceName = 'EWI_SingleStepReportFormat';
    const workPackageModelObject = ewiService.getWorkPackage();
    if( isFullReport && workPackageModelObject ) {
        const workPackageTypeHierarchyArray = workPackageModelObject.modelType.typeHierarchyArray;
        if( workPackageTypeHierarchyArray.indexOf( 'MEProcessRevision' ) !== -1 ) {
            preferenceName = 'EWI_FullPackageProcessReportFormat';
        } else if( workPackageTypeHierarchyArray.indexOf( 'CCObject' ) !== -1 ||
            workPackageTypeHierarchyArray.indexOf( 'MECollaborationContext' ) !== -1 ) {
            preferenceName = 'EWI_FullPackageReportFormat';
        }
    }
    return preferenceName;
}

/**
 * Update format list.
 *
 * @param {ObjectArray} preferences list of preferences.
 * @param {String} formatPreferenceName report format preference name.
 *
 * @return {StringArray} list of formats to display.
 */
export function updateFormatList( preferences, formatPreferenceName ) {
    const formatList = preferences[ formatPreferenceName ];
    const formatListToDisplay = formatList.map( format => format.split( ':' )[ 0 ] );
    const list = listBoxSvc.createListModelObjectsFromStrings( formatListToDisplay );
    return {
        list,
        selected: formatListToDisplay[0]
    };
}

/**
 * Set the report scope
 *
 * @param {Boolean} isFullReport - true if FullReport else CurrentStep.
 * @param {String} selectedFormat - format selected by user
 * @param {StringArray} preferencesValues - preferences.
 *
 * @return {String} report scope.
 */
export function createReportScope( isFullReport, selectedFormat, preferencesValues ) {
    const reportMode = isFullReport ? 'FullReport' : 'CurrentStep';
    let formatAndStyle = '';
    const formatList = preferencesValues[ getFormatPreferenceName( isFullReport ) ];
    formatList.forEach( format => {
        if( format.indexOf( selectedFormat + ':' ) === 0 ) {
            formatAndStyle = format.substr( selectedFormat.length );
        }
    } );
    return reportMode + formatAndStyle;
}

/**
 * This method is used to toggle a view model's variable state on progress start/end event.
 *
 * @param {boolean} flag - true if report generation is in progress else false.
 * @return {boolean} the flag.
 */
export function setProgressFlag( flag ) {
    return flag;
}

export default {
    getSelectedBusinessObjectUid,
    getFormatPreferenceName,
    updateFormatList,
    createReportScope,
    setProgressFlag
};

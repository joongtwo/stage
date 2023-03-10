// Copyright (c) 2022 Siemens

/**
 * Service defines functionalities when CBA Page is launched from Change (ECN)
 * @module js/CBAImpactAnalysisService
 */
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import cbaConstants from 'js/cbaConstants';


/**
 * Check if in Impact Analysis Mode
 *
 * @return {Boolean} true if in Impact Analysis Mode else false.
 */
export let isImpactAnalysisMode = function() {
    let impactAnalysis = appCtxSvc.getCtx( cbaConstants.CTX_PATH_IMPACT_ANALYSIS );
    return impactAnalysis ? Boolean( impactAnalysis.isImpactAnalysisMode ) : Boolean( impactAnalysis );
};

/**
 * Get the provider name to fetch Aligned Objects when in Impact Analysis
 *
 * @returns {Promise} Promise after getting the provider name
 */
export let getProviderName = function() {
    let deferred = AwPromiseService.instance.defer();
    // If ECN is not set we send the provider name as an empty string.
    let impactAnalysis = appCtxSvc.getCtx( cbaConstants.CTX_PATH_IMPACT_ANALYSIS );
    let providerName = impactAnalysis.alignedTargetProviderInECN ? impactAnalysis.alignedTargetProviderInECN : '';
    let output = {
        providerName: providerName
    };
    deferred.resolve( output );
    return deferred.promise;
};

/**
 * Filter the columnsToExclude for the given provider
 * @param {String} provider - provider
 *
 * @return {Array} Columns to exclude.
 */
export let filterColumnsToExclude = function( provider ) {
    // The action column should be shown only when the CBA page is launched from Change Summary Page
    let impactAnalysis = appCtxSvc.getCtx( cbaConstants.CTX_PATH_IMPACT_ANALYSIS );

    if( impactAnalysis.ECNForImpactAnalysis ) {
        let columnToInclude = 'Awb0ConditionalElement.awb0MarkupType';

        //The Action Column(awb0MarkupType) should be shown only for the Solution Item Structure which was opened from change
        // For all other cases awb0MarkupType will be excluded from the columns to be loaded.
        if( provider && impactAnalysis.sourceTopItem && impactAnalysis.sourceTopItem.uid === provider.baseSelection.uid ) {
            let columnsToExclude;
            // Remove the columnToInclude from columnsToExclude for the given contextKey
            columnsToExclude = provider.columnsToExclude.filter( function( column ) {
                return column !== columnToInclude;
            } );
            return columnsToExclude;
        }
    }
    return provider.columnsToExclude;
};

/**
 * Evaluates whether to show redlines in Impact Analysis Mode
 *
 * @param {String} provider - provider
 * @returns {Boolean} true or false
 */
export let shouldShowRedlinesInIA = function( provider ) {
    let impactAnalysis = appCtxSvc.getCtx( cbaConstants.CTX_PATH_IMPACT_ANALYSIS );
    return Boolean( impactAnalysis.ECNForImpactAnalysis && impactAnalysis.sourceTopItem.uid === provider.baseSelection.uid );
};

/**
 * CBA ImpactAnalysis Service
 */

const exports = {
    isImpactAnalysisMode,
    getProviderName,
    filterColumnsToExclude,
    shouldShowRedlinesInIA
};
export default exports;

// Copyright (c) 2022 Siemens

/**
 * Service for ep Missing In Source Indication table column renderer
 *
 * @module js/epMissingInSrcIndicationTablePropertyRenderer
 */
import { getBaseUrlPath } from 'app';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import { renderComponent } from 'js/declReactUtils';
import epContextService from 'js/epContextService';
import epObjectPropertyCacheService from 'js/epObjectPropertyCacheService';
import epTableCellRenderer from 'js/epTableCellRenderer';
import { includeComponent } from 'js/moduleLoader';
import localeService from 'js/localeService';
const localTextBundle = localeService.getLoadedText( 'changeIndicationMessages' );

/**
 * Render Missing In Source indication.
 * Calls methods to get icon image source and icon element.
 * Appends it to the container element.
 *
 * @param {Object} vmo - the vmo for the cell
 * @param {DOMElement} containerElement - the container element
 */
export function rendererMissingInSourceOrChangeIndication( vmo, containerElement ) {
    if( !containerElement ) {
        return;
    }

    let isMissingInSrc = false;
    const changeInSrc = epObjectPropertyCacheService.getProperty( vmo.uid, 'ChangeIndication' );
    isMissingInSrc = changeInSrc && changeInSrc[ 0 ] === 'Impacted' ? 'changeIndication' : false;
    isMissingInSrc = changeInSrc && changeInSrc[ 0 ] === 'MissingInSource' ? true : isMissingInSrc;

    const pageContext = epContextService.getPageContext();
    if( pageContext && pageContext.loadedObject ) {
        const contextObjectUid = pageContext.loadedObject.uid;
        const missingInSrcObject = epObjectPropertyCacheService.getProperty( contextObjectUid, 'accountabilityResponse' ).missingInSrc;
        if( missingInSrcObject && missingInSrcObject.includes( cdm.getObject( vmo.uid ) ) ) {
            isMissingInSrc = true;
        }
    }

    const imageSrc = isMissingInSrc ? getIconSource( isMissingInSrc ) : '';
    let title = '';
    let messages = [];
    if( isMissingInSrc === 'changeIndication' ) {
        let impactedCnMsg = localTextBundle.childImpactedChangeIndicationTooltipSecondText;
        let stateCtx = appCtxSvc.getCtx( 'state' );
        let ctxParams = stateCtx.params;
        if( ctxParams.tracking_cn ) {
            let tracking_cn = cdm.getObject( ctxParams.tracking_cn );
            let cnName = tracking_cn && tracking_cn.props.object_string ? tracking_cn.props.object_string.uiValues[ 0 ] : '';
            let msg = impactedCnMsg.replace( '{0}', cnName );
            messages.push( msg );
            title = localTextBundle.changeIndicationTooltipTitle;
        }
    }

    if( isMissingInSrc === true ) {
        messages.push( localTextBundle.missingInAssemblyDescription );
        title = localTextBundle.missingInAssemblyTitle;
    }

    if( imageSrc ) {
        const props = {
            imageSrc,
            tooltipView: 'MfeGenericTooltip',
            tooltipData: {
                extendedTooltip: {
                    title,
                    messages,
                    className: 'aw-ep-changeTooltip'
                }
            },
            isClickable: false
        };
        let extendedTooltipElement = includeComponent( 'MfeTableCellImage', props );
        renderComponent( extendedTooltipElement, containerElement );
    }
}

/**
 * Gets icon image source
 * @param {boolean} isChange - true if we should return change indication
 * @return {String} image source
 */
function getIconSource( isChange ) {
    let iconName = isChange === 'changeIndication' ? 'indicatorImpacted16.svg' : 'indicatorMissingInSource16.svg';
    return `${getBaseUrlPath()}/image/${iconName}`;
}

/**
 * Renderer Missing In Source column header
 *
 * @param {DOMElement} containerElement - the icon container element
 * @param {String} columnField - column field name
 * @param {Object} tooltip - tooltip object
 * @param {Object} column - column object
 */
function renderMissinInSrcColumnHeader( containerElement, columnField, tooltip, column ) {
    epTableCellRenderer.columnHeaderIndicationRenderer( containerElement, columnField, column );
}

let exports;
export default exports = {
    rendererMissingInSourceOrChangeIndication,
    renderMissinInSrcColumnHeader
};

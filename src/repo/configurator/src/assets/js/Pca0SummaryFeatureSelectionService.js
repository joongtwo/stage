// Copyright (c) 2022 Siemens

/**
 * Helper service for Pca0SummaryFeatureSelectionService
 *
 * @module js/Pca0SummaryFeatureSelectionService
 */
import AwDefaultCell from 'viewmodel/AwDefaultCellViewModel';
import AwDefaultCellContent from 'viewmodel/AwDefaultCellContentViewModel';

var exports = {};

/**
 * SummarySelection component updated - scroll into view the added element
 * @param {Object} props - passed in props from parent
 * @param {Object} elementRefList - element reference
 * */
export let pca0SummarySelectionComponentUpdated = function( props, elementRefList ) {
    if( props.focused && elementRefList.get( 'Pca0SummaryFeatureSelection' ).current ) {
        const featureEl = elementRefList.get( 'Pca0SummaryFeatureSelection' ).current;
        if( featureEl ) {
            featureEl.scrollIntoView( { behavior: 'smooth', block: 'center', inline: 'center' } );
        }
    }
};

/**
 * Rendering method
 *
 * @param {Object} props - props
 * @returns {Object} - Returns view
 */
export const pca0SummarySelectionsRenderFunction = ( props ) => {
    let { elementRefList } = props;
    return (
        <div className='aw-layout-flexRow pca0summaryrow' ref={elementRefList.get( 'Pca0SummaryFeatureSelection' )}>
            { !props.isFamilySelection && props.isThumbnailDisplay &&  <AwDefaultCell  vmo={props} ></AwDefaultCell> }
            { !props.isFamilySelection && !props.isThumbnailDisplay && <AwDefaultCellContent vmo={props}></AwDefaultCellContent> }
        </div>
    );
};

export default exports = {
    pca0SummarySelectionsRenderFunction,
    pca0SummarySelectionComponentUpdated
};

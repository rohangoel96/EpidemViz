$(document).ready(function() {
    var dsv = d3.dsv(";", "text/plain");
    dsv("data/official.csv", function(error, data) {
      if (error) throw error;
      processData(data);
    });
});

function processData(data) {
    var species_host = [],
        diseases = []
        symptoms = [];
    
    data.map(function(d) {
        species_host = species_host.concat(d.species.split(','));
        diseases = diseases.concat(d.diseases.split(','));
        symptoms = symptoms.concat(d.symptoms.split(','));
    });

    appendEntities("#entity-host", species_host, 'species_host_')
    appendEntities("#entity-diseases", diseases, 'diseases_')
    appendEntities("#entity-symptoms", symptoms, 'symptoms_')

}

function appendEntities(containerID, objList, idText) {
    _.uniq(objList).forEach(function(item) {
        $(containerID).append(
            $(document.createElement('label')).text(item)
            .append(
                $(document.createElement('input')).attr({
                    id:    idText + item,
                    name:  idText + item,
                    value: idText + item,
                    class: 'entities-checkbox',
                    type:  'checkbox'
                })
            )  
        );
    })
}
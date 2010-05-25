pull_req1: {
	type: "pull_req"
	, db: "peer1"
	, gimme: [ 
			{
				 table: "nsl_cluster"
				, uuid: "dfdfsedfdfdfdfwsdefsdf"
				, content: null
			} 	
			, {
				 table: "log"
				, uuid: "dfdfsedfdfdfdfwsdefsdf"
				, content: null
			}
			, {
				 table: "log"
				, uuid: "dfdfddfsedfdfdfdfwsdefsdf"
				, content: null
			}
		]
}


pull_res1: {
	type: "pull_res"
	, db: "peer2"
	, objs:  [
			{
				 table: "nsl_cluster"
				, uuid: "dfdfsedfdfdfdfwsdefsdf"
				, content: [
					 	{
							 table: "user"
							, uuid: "dfdfsedfdfdfdfwsdefsdf"
						}
						, {
							 table: "user"
							, uuid: "dfdfddfsedfdfdfdfwsdefsdf"
						}
					] 	
		}
		
	] 
}

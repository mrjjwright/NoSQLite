pull_req1: {
	type: "pull_req"
	, db: "peer1"
	, gimme: [ "dfdfsedfdfdfdfwsdefsdf", "dfdfdf2dfwdfsdfdfs", "dfdfw2dfsdfwedsd"]
}


pull_res1: {
	type: "pull_res"
	, db: "peer2"
	, objs:  [
			{
				 table: "nsl_cluster"
				, uuid: "dfdfsedfdfdfdfwsdefsdf"
				, date_created: "dfdfsdfdf"
				, contents: [ "dfdfsedfdfdfdfwsdefsdf", "dfdfdf2dfwdfsdfdfs", "dfdfw2dfsdfwedsd"]
			}
			, {
				 table: "user"
				, uuid: "dfdfsedfdfdfdfwsdefsdf"
				, date_created: "dfdfsdfdf"
				, contents: { 
					name: "John Wright"
					, status: "awesome"
				}
			}
			, {
				 table: "user"
				, uuid: "dfdfsedfdfdfdfwsdefsdf"
				, date_created: "dfdfsdfdf"
				, contents: { 
					name: "Renee Wright"
					, status: "tired"
				}
			}
		]
}

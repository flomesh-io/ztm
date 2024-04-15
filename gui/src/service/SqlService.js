export default class SqlService {
	
	getSql({where, sortField, sortOrder, pageSize, current}){
		let _order = sortOrder==-1?'desc':'asc';
		let sql = `Select 
			s.id as id,
		  s.connection_id as connection_id,
			s.protocol as protocol,
			s.request_begin_time as request_begin_time,
			s.request_end_time as request_end_time,
			s.request_size as request_size,
			s.response_begin_time as response_begin_time,
			s.response_end_time as response_end_time,
			s.response_size as response_size,
			s.response_time as response_time,
			s.result as result,
		  h.scheme as scheme,
		  h.method as method,
		  h.status as status,
		  h.host as host,
		  h.url as url,
		  h.content_type as content_type,
			c.client_ip as client_ip
		from
		  session s
		join http h on
		  s.id == h.id
		join connection c on
		  s.connection_id == c.id
		${where ||''} order by ${sortField || 'request_begin_time'} ${_order} Limit ${pageSize} Offset ${current}`;
		return sql;
	}

	getDetailSql(connection_id,session_id){
		let sql = `Select 
			id,
			connection_id,
			session_id,
			protocol,
			direction,
			head,
			body,
			tail,
			begin_time,
			end_time
		 From message where connection_id = '${connection_id}' and session_id = '${session_id}'`;
		return sql;
	}
	getCount(where){
		let sql = `Select count(1) 
		 from
		   session s
		 join http h on
		   s.id == h.id
		 join connection c on
		   s.connection_id == c.id
		 ${where ||''} `;
		return sql
	}
	getLeftSql(where, groupBy){
		let sql = `Select count(1) as value,${groupBy} as name 
		 from
		   session s
		 join http h on
		   s.id == h.id
		 join connection c on
		   s.connection_id == c.id
		 ${where ||''} group by ${groupBy}`;
		return sql
	}
	getRightSql(where){
		let sql = `Select s.response_time as response_time, s.request_begin_time as request_begin_time
		 from
		   session s
		 join http h on
		   s.id == h.id
		 join connection c on
		   s.connection_id == c.id
		 ${where ||''} order by s.request_begin_time asc`;
		return sql
	}
}

export function textSanitize(str: string): string{
	if(typeof str !== "string"){
		return "";
	}
	try{
		let s = str;

		s = s.normalize("NFKC");
		s = s.replace(/<[^>]*>/g, "");
		s = s.replace(/[^\x20-\x7E]/g, "");
		
		return s;
	}
	catch(error: unknown){
		return "";
	}
}
package app.dorozhka.music.data.remote

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

@Serializable
data class TrackDto(
    val id: String,
    val title: String,
    val artist: String = "",
    @SerialName("stream_url") val audioUrl: String,
    @SerialName("cover_url") val imageUrl: String? = null,
    @SerialName("duration") val durationSeconds: Double = 0.0,
    val album: String? = null
)

@Serializable
data class TrackListDto(val items: List<TrackDto> = emptyList(), val total: Int = 0)

interface MusicApiService {
    @GET("api/v1/search")
    suspend fun searchTracks(@Query("q") query: String, @Query("limit") limit: Int = 50): TrackListDto

    @GET("api/v1/search")
    suspend fun getTrending(@Query("q") query: String = "", @Query("limit") limit: Int = 40): TrackListDto

    @GET("api/v1/tracks/{id}")
    suspend fun getTrackDetails(@Path("id") id: String): TrackDto
}
